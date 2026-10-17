"use client";

import dynamic from "next/dynamic";

const HomeScreen = dynamic(() => import("@/components/HomeScreen"), {
  ssr: false,
});

export default function HomePage() {
  return <HomeScreen />;
}
