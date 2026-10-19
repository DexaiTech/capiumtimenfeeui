import { useLocation } from 'react-router';

/** Shows where the router is, so a test can assert a navigation. */
export function Where() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}
