from ..schemas import Product

def recommendation_allowed(product: Product) -> bool:
    """Eligibility gate only. Never proves that the part matches an appliance."""
    return not product.is_synthetic and product.verification.status == 'verified'
