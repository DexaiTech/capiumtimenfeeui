import { useLocation } from 'react-router';

/** Shows where the router is, so a test can say which tab the URL names. */
export function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}
