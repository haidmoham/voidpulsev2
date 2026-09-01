import "./style.css";
import { DemoIntensitySignal } from "./audio/IntensitySignal";
import { FallDynamics } from "./dynamics/FallDynamics";
import { FallWorld } from "./world/FallWorld";

const container = document.querySelector<HTMLElement>("#app");

if (!container) {
  throw new Error("Missing #app container");
}

const signal = new DemoIntensitySignal();
const dynamics = new FallDynamics();
const world = new FallWorld(container);
let previousTime = performance.now();

function frame(now: number): void {
  const deltaSeconds = Math.min((now - previousTime) / 1000, 0.1);
  const timeSeconds = now / 1000;
  previousTime = now;

  const state = dynamics.update(signal.sample(timeSeconds), deltaSeconds);
  world.render(state, timeSeconds);
  requestAnimationFrame(frame);
}

window.addEventListener("resize", () => world.resize());
requestAnimationFrame(frame);
