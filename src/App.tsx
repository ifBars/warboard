import Planner from "./pages/Planner";
import type { Plan } from "./model";

export default function App(props: { initial: Plan; warning: string }) {
  return <Planner {...props} />;
}
