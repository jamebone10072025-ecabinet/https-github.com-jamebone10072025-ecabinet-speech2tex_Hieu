import React, { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check, Search } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "../data/languages";
import { SupportedLanguage } from "../types";

interface LanguageSelectorProps {
  value: string; // language code, e.g. "vi-VN"
  onChange: (lang: SupportedLanguage) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onChange,
  label = "Ngôn ngữ giọng nói",
  className = "",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === value) || SUPPORTED_LANGUAGES[0];

  const filteredLanguages = SUPPORTED_LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}

      <button
        type="button"
        id="btn-language-selector"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left text-sm font-medium shadow-sm transition-all duration-150 ${
          disabled
            ? "opacity-60 cursor-not-allowed"
            : "hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="text-lg leading-none">{selectedLang.flag}</span>
          <span className="text-slate-800 dark:text-slate-200 truncate">
            {selectedLang.name}
          </span>
          <span className="text-xs text-slate-400 font-normal">
            ({selectedLang.code})
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-64 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 max-h-72 flex flex-col animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm ngôn ngữ..."
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                autoFocus
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-slate-50 dark:divide-slate-800">
            {filteredLanguages.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                Không tìm thấy ngôn ngữ phù hợp
              </div>
            ) : (
              filteredLanguages.map((lang) => {
                const isSelected = lang.code === selectedLang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      onChange(lang);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium"
                        : "hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">{lang.flag}</span>
                      <span>
                        <span className="font-medium">{lang.name}</span>
                        <span className="text-slate-400 ml-1">
                          ({lang.englishName})
                        </span>
                      </span>
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
