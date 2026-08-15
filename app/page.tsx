import type { Metadata } from "next";
import InventoryApp from "./inventory-app";

export const metadata: Metadata = {
  title: "Nook — your home, remembered",
  description:
    "A visual, room-by-room home inventory that remembers exactly where everything lives.",
};

export default function HomePage() {
  return <InventoryApp />;
}
