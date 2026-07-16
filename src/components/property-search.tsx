export function PropertySearch() {
  return (
    <form className="search-panel" action="/properties" method="get" aria-label="Search properties">
      <label><span>Looking to</span><select name="purpose" defaultValue="sale"><option value="sale">Buy</option><option value="rent">Rent</option><option value="lease">Lease</option></select></label>
      <label><span>Property type</span><select name="type" defaultValue=""><option value="">All properties</option><option>Apartment</option><option>Independent House</option><option>Open Plot</option><option>Agricultural Land</option><option>Commercial</option></select></label>
      <label className="search-location"><span>Location</span><input name="location" placeholder="Locality, town or property ID" /></label>
      <label><span>Budget</span><select name="budget" defaultValue=""><option value="">Any budget</option><option value="25">Under ₹25L</option><option value="50">₹25L–₹50L</option><option value="100">₹50L–₹1Cr</option><option value="100+">Above ₹1Cr</option></select></label>
      <button className="button" type="submit">Search properties</button>
    </form>
  );
}
