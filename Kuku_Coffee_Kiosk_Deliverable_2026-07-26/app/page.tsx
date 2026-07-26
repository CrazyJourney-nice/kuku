import type { Metadata } from "next";
import { KioskApp } from "./KioskApp";

export const metadata: Metadata = {
  title: "Kuku Coffee 智能咖啡站",
  description:
    "竖屏触控咖啡售货机体验：选择饮品、定制口味并跟随 Kuku 完成取杯。",
};

export default function Home() {
  return <KioskApp />;
}
