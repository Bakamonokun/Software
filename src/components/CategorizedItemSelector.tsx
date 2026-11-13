import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, FolderOpen, Search } from 'lucide-react';
import { ItemMaster, ProfileType } from '../types/pos';
import { formatNumber, getCategorizedItemSuggestions } from '../utils/accounting';

interface CategorizedItemSelectorProps {
  items: ItemMaster[];
  profile: ProfileType;
  selectedItemId: string;
  onSelect: (item: ItemMaster) => void;
  placeholder?: string;
}

export const CategorizedItemSelector: React.FC<CategorizedItemSelectorProps> = ({
  items,
  profile,
  selectedItemId,
  onSelect,
  placeholder = 'Type letter or word to search items by category...',
}) => {
  const [query, setQuery] = useState<string>('');
  const [open, setOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedItem = items.find((i) => i.id === selectedItemId);

  useEffect(() => {
    if (selectedItem && !open) {
      setQuery(selectedItem.name);
    } else if (!selectedItemId && !open) {
      setQuery('');
    }
  }, [selectedItem, selectedItemId, open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const categorizedGroups = getCategorizedItemSuggestions(items, open ? query : '');

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className="w-full rounded border border-slate-300 bg-white pl-8 pr-7 py-1.5 text-xs text-slate-900 focus:border-[#0d6e6e] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="absolute right-1.5 text-slate-500 hover:text-slate-800 p-0.5 cursor-pointer"
          tabIndex={-1}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-40 max-h-72 overflow-y-auto rounded border border-slate-300 bg-white shadow-xl">
          {items.length === 0 ? (
            <div className="p-3 text-xs text-slate-500">
              No items registered in Item Master yet. Add items in <strong>Master &rarr; Item Master</strong>.
            </div>
          ) : categorizedGroups.length === 0 ? (
            <div className="p-3 text-xs text-slate-500">
              No items matching &ldquo;{query}&rdquo;. Try another letter or word.
            </div>
          ) : (
            categorizedGroups.map((group) => (
              <div key={group.category} className="border-b border-slate-100 last:border-b-0">
                <div className="sticky top-0 bg-slate-100 px-3 py-1 text-[11px] font-bold text-[#0d6e6e] flex items-center justify-between border-b border-slate-200">
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="w-3 h-3" />
                    {group.category}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {group.items.length} item(s)
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelect(item);
                        setQuery(item.name);
                        setOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-teal-50/70 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">{item.name}</span>
                        <span className="ml-2 font-mono text-[11px] text-slate-500">
                          [{item.code}]
                        </span>
                        {profile === 'GST' && item.hsnCode && (
                          <span className="ml-2 font-mono text-[10px] text-slate-500">
                            HSN: {item.hsnCode} · GST {item.gstPercent}%
                          </span>
                        )}
                      </div>
                      <div className="text-right font-mono shrink-0">
                        {profile === 'GST' ? (
                          <span className="text-slate-700">
                            Base: ₹{formatNumber(item.basePrice)} &rarr;{' '}
                            <strong className="text-[#0d6e6e]">
                              ₹{formatNumber(item.sellingPrice)}
                            </strong>
                          </span>
                        ) : (
                          <strong className="text-[#0d6e6e]">
                            ₹{formatNumber(item.sellingPrice)}
                          </strong>
                        )}
                        <span
                          className={`ml-2 text-[10px] ${
                            item.stockQty <= item.minStockLevel
                              ? 'text-red-600 font-bold'
                              : 'text-slate-500'
                          }`}
                        >
                          Stk: {item.stockQty} {item.unit}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
