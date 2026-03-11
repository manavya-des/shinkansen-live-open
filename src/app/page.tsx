"use client";

import dynamic from "next/dynamic";

const MapClient = dynamic(() => import("@/components/map-client"), {
  ssr: false,
});

export default function Home() {
  return <MapClient />;
}
