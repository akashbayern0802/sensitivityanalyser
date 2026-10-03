'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  sub: string;
  href: string;
  linkLabel: string;
  serverChecked: boolean;
}

export function ChecklistClient({ items }: { items: ChecklistItem[] }) {
  const [llmConfigured, setLlmConfigured] = useState(false);

  useEffect(() => {
    // Check if an LLM provider has been saved in localStorage
    const provider = localStorage.getItem('sa_provider');
    const hasKey =
      provider === 'google-vertex'
        ? !!(
            process.env.NEXT_PUBLIC_VERTEX_CONFIGURED === 'true' ||
            localStorage.getItem(`sa_apiKey_${provider}`)
          )
        : provider === 'ollama'
        ? true // Ollama needs no key
        : !!(provider && localStorage.getItem(`sa_apiKey_${provider}`));

    setLlmConfigured(hasKey);
  }, []);

  const resolvedItems = items.map((item) => ({
    ...item,
    checked: item.id === 'llm' ? llmConfigured : item.serverChecked,
  }));

  return (
    <ul className="divide-y divide-gray-100">
      {resolvedItems.map((item) => (
        <li
          key={item.id}
          className={`px-6 py-4 flex items-center space-x-4 transition-opacity ${
            item.checked ? 'opacity-70' : 'opacity-100'
          }`}
        >
          {item.checked ? (
            <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
          ) : (
            <Circle className="w-6 h-6 text-gray-300 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h4
              className={`text-sm font-medium ${
                item.checked ? 'text-gray-500 line-through' : 'text-gray-900'
              }`}
            >
              {item.label}
            </h4>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{item.sub}</p>
          </div>
          {!item.checked && (
            <Link
              href={item.href}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500 shrink-0"
            >
              {item.linkLabel}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
