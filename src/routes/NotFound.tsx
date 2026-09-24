import { Link } from "react-router";
import { Empty } from "../components/ui";
import { Compass } from "../components/phosphor";

export default function NotFound() {
  return (
    <div className="pt-16">
      <Empty icon={<Compass size={26} />} title="Nothing lives here" body="The link may be old, or the page moved." action={<Link to="/" className="btn btn-primary">Back to today</Link>} />
    </div>
  );
}
