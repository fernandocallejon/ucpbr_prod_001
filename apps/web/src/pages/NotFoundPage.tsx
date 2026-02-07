// ============================================================
// RetailNexus — 404 Not Found Page
// ============================================================

import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <FileQuestion className="h-16 w-16 text-gray-300" />
      <h1 className="mt-6 text-4xl font-bold text-gray-900">404</h1>
      <p className="mt-2 text-lg text-gray-500">Página não encontrada</p>
      <p className="mt-1 text-sm text-gray-400">
        A página que você procura não existe ou foi movida.
      </p>
      <Link to="/" className="btn-primary mt-8">
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
