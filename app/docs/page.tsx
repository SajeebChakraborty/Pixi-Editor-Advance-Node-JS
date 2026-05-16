"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

// SwaggerUI must be loaded client-side
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocs() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          API Documentation
        </h1>
        <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
          <SwaggerUI url="/swagger.yaml" />
        </div>
      </div>
    </div>
  );
}
