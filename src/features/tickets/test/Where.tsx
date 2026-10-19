import { useLocation } from 'react-router';

/** Where the router is, so the filters in the URL and the navigation can be asserted. */
export function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}
