"use client";

import { useState } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export default function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const validateInput = (value: string): boolean => {
    // US Zip code: 5 digits
    const zipRegex = /^\d{5}$/;
    // City name: at least 2 characters, letters and spaces
    const cityRegex = /^[a-zA-Z\s]{2,}$/;

    if (zipRegex.test(value) || cityRegex.test(value)) {
      setError("");
      return true;
    }

    setError("Enter a valid US zip code or city name");
    return false;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setError("Please enter a location");
      return;
    }

    if (validateInput(trimmedQuery)) {
      onSearch(trimmedQuery);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError("");
            }}
            placeholder="Enter zip code or city"
            disabled={isLoading}
            className="flex-1 px-4 py-3
                     bg-surface dark:bg-dark-surface
                     border border-accent-secondary/30 dark:border-dark-accent-secondary/30
                     rounded-lg
                     text-text-primary dark:text-dark-text-primary
                     placeholder:text-text-secondary dark:placeholder:text-dark-text-secondary
                     focus:outline-none focus:border-accent-primary dark:focus:border-dark-accent-primary
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3
                     bg-accent-secondary dark:bg-dark-accent-secondary
                     hover:bg-accent-primary dark:hover:bg-dark-accent-primary
                     text-text-primary dark:text-dark-text-primary
                     rounded-lg font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
        </div>
        {error && (
          <p className="text-warm dark:text-dark-warm text-sm pl-4">{error}</p>
        )}
      </div>
    </form>
  );
}
