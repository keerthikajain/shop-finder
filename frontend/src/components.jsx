import {useT} from './locale.js';
import React from 'react';
import {PartSupport} from './part-support.jsx';

export const categories = {
  washing_machine: 'Washing machines', refrigerator: 'Refrigerators', fan: 'Fans',
  mixer_grinder: 'Mixer grinders', electric_iron: 'Electric irons', water_purifier: 'Water purifiers',
};

const paths = {
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
  catalogue: <><path d="M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3zM12 6v15"/></>,
  staff: <><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3"/></>,
  question: <><path d="M21 11a9 9 0 0 1-9 9H4l-3 2 2-7a9 9 0 1 1 18-4Z"/><path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 4M12 16h.01"/></>,
  drawer: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 12h18M9 7h6M9 16h6"/></>,
  mic: <><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  reset: <><path d="M3 9a9 9 0 1 1 0 7M3 3v6h6"/></>,
  sliders: <><path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="2"/><circle cx="16" cy="17" r="2"/></>,
  location: <><path d="M19 10c0 6-7 12-7 12S5 16 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  sound: <><path d="m3 9 5 0 5-5v16l-5-5H3zM17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14"/></>,
  plus: <path d="M12 4v16M4 12h16"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  washing_machine: <><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M4 7h16M7 4.5h.01M10 4.5h.01"/><circle cx="12" cy="14" r="5"/><path d="M8 14c3-3 5 3 8 0"/></>,
  refrigerator: <><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 9h14M8 5v2M8 12v4"/></>,
  fan: <><circle cx="12" cy="10" r="8"/><circle cx="12" cy="10" r="1.5"/><path d="M12 8c-5-7-8 1-2 2M14 10c8-2 3-8-1-2M12 12c-2 8 6 6 3 0M12 18v4M7 22h10"/></>,
  mixer_grinder: <><path d="m6 2 2 12h8l2-12ZM8 14l-3 8h14l-3-8M18 5h3v5h-4M10 18h4"/></>,
  electric_iron: <><path d="M3 18c2-6 6-9 15-9l3 9v3H3zM8 9V5h8l2 4M7 17h9"/></>,
  water_purifier: <><rect x="4" y="2" width="16" height="20" rx="3"/><path d="M4 12h16M12 12v3h3M8 18h8"/><path d="M12 5s-2 2-2 3a2 2 0 0 0 4 0c0-1-2-3-2-3Z"/></>,
};

export function Icon({name, className = ''}) {
 const t=useT();
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name] || paths.drawer}</svg>;
}

export const specLabels = {
  voltage_v: ['Voltage', 'V'], capacitance_uf: ['Capacitance', 'µF'], power_w: ['Power', 'W'],
  frequency_hz: ['Frequency', 'Hz'], supply: ['Supply', ''], current_a: ['Current', 'A'],
  width_mm: ['Width', 'mm'], height_mm: ['Height', 'mm'], length_mm: ['Length', 'mm'],
  depth_mm: ['Depth', 'mm'], inner_diameter_mm: ['Inner diameter', 'mm'],
  outer_diameter_mm: ['Outer diameter', 'mm'], outlet_diameter_mm: ['Outlet diameter', 'mm'],
  mounting_spacing_mm: ['Mounting spacing', 'mm'], inlet_thread_inch: ['Inlet thread', 'in'],
  length_inch: ['Length', 'in'], tube_outer_diameter_inch: ['Tube outer diameter', 'in'],
  cutoff_c: ['Cutoff temperature', '°C'], filtration_micron: ['Filtration', 'µm'],
};
export function fieldLabel(key) {
  return (specLabels[key]?.[0] || key.replaceAll('_', ' ')).replace(/^./, c => c.toUpperCase());
}
export function specValue(key, value) {
  return `${value}${specLabels[key]?.[1] ? ` ${specLabels[key][1]}` : ''}`;
}
export function ProductCard({product: p, active, onSelect}) {
 const t=useT();
  return <button className={`part-card ${active ? 'is-selected' : ''}`} onClick={onSelect} aria-pressed={active} aria-label={`Inspect ${p.name}, ${p.part_number || p.id}`}>
    <div className="part-category"><Icon name={p.appliance_category}/><span>{t(categories[p.appliance_category])}</span><Icon name="arrow"/></div>
    <div className="part-identity"><div className={`part-art art-${p.appliance_category}`}><Icon name={p.appliance_category}/><span>{t("PART")}</span></div><div><h3>{p.name}</h3><span className="part-number">{p.part_number || t('Part number not recorded')}</span></div></div>
    <div className="spec-chips">{Object.entries(p.specifications).map(([key, value]) => <span className={key === 'capacitance_uf' ? 'highlight' : ''} key={key}><span className={specLabels[key] ? 'sr-only' : ''}>{t(fieldLabel(key))}: </span>{specValue(key, value)}</span>)}</div>
    <p className="connector">{p.connector_type || t('Connector not recorded')}</p>
    <div className="card-location"><span className="card-location-label">{t(p.is_synthetic?'Demo location':'Catalogue location')}</span><div>{['rack','shelf','box'].map(key=><span key={key}>{t(fieldLabel(key))} <b>{p.location[key]}</b></span>)}</div></div><div className="part-bottom"><span className="verification-dot"/>{t(p.is_synthetic ? 'Synthetic · Unverified' : fieldLabel(p.verification.status))}<span className="inspect-label">{t("Inspect")}</span></div>
  </button>;
}

export function PartDetails({product: p, onEdit, onClose, detailRef, standalone=false,canEdit=true}) {
 const t=useT();
  return <aside className={`detail-panel glass ${p ? 'has-selection' : ''} ${standalone?'standalone-detail':''}`} aria-label="Part details" ref={detailRef} tabIndex={-1}>
    {!p ? <div className="detail-empty"><div className="empty-icon"><Icon name="drawer"/></div><span className="eyebrow">{t("A PLACE FOR EVERY PART")}</span><h2>{t("See where it belongs.")}</h2><p>{t("Select a part to check its specifications and find its rack, shelf and box.")}</p><div className="empty-drawers"><span>{t("Rack")}</span><span>{t("Shelf")}</span><span>{t("Box")}</span></div><p className="quiet">{t("A catalogue match is a candidate, not proof of compatibility.")}</p></div> : <>
      <div className="detail-top"><span className="badge">{t(p.is_synthetic ? 'Synthetic · Unverified' : fieldLabel(p.verification.status))}</span>{!standalone&&<button className="detail-back secondary" onClick={onClose}>{t('Back to results')}</button>}</div>
      <span className="eyebrow">{t(categories[p.appliance_category])}</span><h2>{p.name}</h2><p className="part-number">{p.part_number || t('Part number not recorded')}</p>
      {standalone&&<div className="spec-chips">{Object.entries(p.specifications).map(([key,value])=><span key={key}>{t(fieldLabel(key))}: {specValue(key,value)}</span>)}</div>}<div className="location-panel" data-tour="location"><div className="location-title"><Icon name="location"/>{t(p.is_synthetic ? 'Fictional demo location' : 'Catalogue location')}</div><div className="location-tiles">{['rack','shelf','box'].map(key => <div className="location-tile" key={key}><Icon name="drawer"/><span>{t(fieldLabel(key))}</span><strong>{p.location[key]}</strong></div>)}</div></div>
      <details className="additional-details" open={standalone?undefined:true}><summary>{t("Specifications and additional details")}</summary><h3 className="detail-subtitle">{t("Part specifications")}</h3><dl>{Object.entries({...p.specifications,...p.dimensions, connector: p.connector_type || 'Not recorded'}).map(([key,value]) => <React.Fragment key={key}><dt>{t(fieldLabel(key))}</dt><dd>{specValue(key, value)}</dd></React.Fragment>)}</dl>
      <div className="detail-note"><b>{t("Also known as")}</b><p>{p.aliases.join(', ') || t('No nicknames recorded')}</p></div>
      </details><div className="compatibility-note"><Icon name="info"/><p>{t(p.compatibility.length ? 'Compatibility evidence is recorded. Ask staff to review it for the exact appliance.' : 'Compatibility is not verified. Similar names do not confirm a fit.')}</p></div>
      {canEdit&&<button className="primary full-width" onClick={onEdit}><Icon name="staff"/>{t("Edit / review as staff")}<Icon name="arrow"/></button>}
    </>}
  </aside>;
}

export function Results({products,selected,onSelect,onEdit,onClose,detailRef,loading=false,canEdit=true}) {
 const t=useT();
 if(products.length===1)return <div className="single-part-result"><PartDetails product={products[0]} canEdit={canEdit} standalone onEdit={()=>onEdit(products[0])} detailRef={detailRef}/><PartSupport key={products[0].id} product={products[0]} canEdit={canEdit} onEdit={onEdit}/></div>;
 return <div className={`workspace ${selected?'with-details':'without-details'}`}><section className="cards" aria-label="Catalogue results" aria-busy={loading}>{products.map(p=><ProductCard key={p.id} product={p} active={selected?.id===p.id} onSelect={()=>onSelect(p)}/>)}{!products.length&&<p className="empty-state glass">{t(loading?'Loading catalogue…':'No records here. Choose another appliance.')}</p>}</section>{selected&&<PartDetails product={selected} canEdit={canEdit} onEdit={()=>onEdit(selected)} onClose={onClose} detailRef={detailRef}/>}</div>;
}
