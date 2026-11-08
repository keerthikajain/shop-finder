"""Conservative, no-secret-output check of tracked files and all fetched Git history.

False negatives remain possible: use GitHub secret scanning and rotate any exposed key.
No secret values are printed; findings show only a file/commit context and rule.
"""
import re
import subprocess
import sys
from pathlib import Path

PATTERNS = {
    "private_key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "github_token": re.compile(r"\b(?:ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]{20,}\b"),
    "aws_access_id": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "openai_token": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b"),
}
ASSIGNMENT = re.compile(
    r"^(?:\+|-)?\s*(?:export\s+)?(?:GNANI_API_KEY|SHOP_FINDER_STAFF_TOKEN|"
    r"OPENAI_API_KEY|AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN)\s*=\s*['\"]?([^\s'\"#]+)"
)
PLACEHOLDER = re.compile(r"^(?:\$\{|\$\(|\$|<|\{|your|example|dummy|test|replace|placeholder|changeme|none|null|false|true)", re.I)


def sensitive(line):
    for rule, pattern in PATTERNS.items():
        if pattern.search(line):
            return rule
    found = ASSIGNMENT.search(line)
    if found:
        value = found.group(1)
        if len(value) >= 12 and not PLACEHOLDER.match(value):
            return "key_assignment"
    return None


def scan_history():
    command = ["git", "log", "--all", "-p", "--no-ext-diff", "--unified=0",
               "--pretty=format:SECURITY_COMMIT:%h"]
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               text=True, encoding="utf-8", errors="replace")
    commit = "unknown"
    path = "unknown"
    warnings = set()
    for line in process.stdout:
        if line.startswith("SECURITY_COMMIT:"):
            commit = line.strip().split(":", 1)[1]
        elif line.startswith("diff --git a/"):
            path = line.split(" b/", 1)[0].removeprefix("diff --git a/").strip()
            if Path(path).name in {".env", ".env.local", ".env.production", "id_rsa", "id_ed25519"}:
                warnings.add((commit, path, "sensitive_file_tracked"))
        elif line.startswith(("+", "-")) and not line.startswith(("+++", "---")):
            finding = sensitive(line)
            if finding:
                warnings.add((commit, path, finding))
    errors = process.stderr.read()
    rc = process.wait()
    if rc:
        print("Secret history scan failed; repository history was not verified.", file=sys.stderr)
        print(errors[:200], file=sys.stderr)
        return 2
    if warnings:
        for commit, file, rule in sorted(warnings):
            print(f"Potential credential exposure: {rule} in {file} at {commit}; review securely and rotate if real.")
        print(f"{len(warnings)} potential historical exposure(s). No secret values printed.")
        return 1
    print("No high-confidence secrets identified in fetched Git history. This is not a guarantee.")
    return 0


if __name__ == "__main__":
    sys.exit(scan_history())
