'use client';

import { useState, useTransition, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { searchUsdaFoods } from '@/app/coach/actions'; // Import search action
import { Loader2, Search, AlertCircle, CheckCircle, PlusCircle } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area"; // Use ScrollArea for results

// Define type for action results (matching actions.ts)
type ActionResult = { success: boolean; error?: string; message?: string };

// Define type for USDA search results (matching actions.ts)
interface UsdaFoodSearchResult {
  fdcId: number;
  description: string;
  brandOwner?: string;
  dataType?: string;
  foodNutrients?: { nutrientName: string; value: number; unitName: string }[];
}

// Define props for the component
interface UsdaImportDialogProps {
  // Action to import the selected food
  importFoodAction: (fdcId: number) => Promise<ActionResult>;
}

export function UsdaImportDialog({ importFoodAction }: UsdaImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UsdaFoodSearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [importResult, setImportResult] = useState<ActionResult | null>(null);
  const [isSearchPending, startSearchTransition] = useTransition();
  const [isImportPending, startImportTransition] = useTransition();

  const handleSearch = useCallback(async () => {
    if (query.trim().length < 3) {
        setSearchError('Please enter at least 3 characters.');
        setSearchStatus('error');
        return;
    }
    setSearchStatus('loading');
    setSearchError(null);
    setSearchResults([]); // Clear previous results

    startSearchTransition(async () => {
      const result = await searchUsdaFoods(query);
      if (result.success && result.foods) {
        setSearchResults(result.foods);
        setSearchStatus('success');
      } else {
        setSearchError(result.error || 'Failed to search foods.');
        setSearchStatus('error');
      }
    });
  }, [query]);

  const handleImportClick = (fdcId: number) => {
    // TODO: Implement the actual import logic using a server action
    console.log("Importing FDC ID:", fdcId);
    setImportStatus('loading');
    setImportResult(null);
    startImportTransition(async () => {
        const result = await importFoodAction(fdcId);
        setImportResult(result);
        setImportStatus(result.success ? 'success' : 'error');
        if (result.success) {
            // Keep dialog open to show success message, user can close manually
            // setIsOpen(false);
            // Optionally clear search results or query after successful import?
            // setQuery('');
            // setSearchResults([]);
            // setSearchStatus('idle');
        }
    });
  };

  // Function to display nutrient summary
  const renderNutrientSummary = (food: UsdaFoodSearchResult) => {
    const nutrients = food.foodNutrients || [];
    const energy = nutrients.find(n => n.nutrientName === 'Energy')?.value;
    const protein = nutrients.find(n => n.nutrientName === 'Protein')?.value;
    const carbs = nutrients.find(n => n.nutrientName === 'Carbohydrate, by difference')?.value;
    const fat = nutrients.find(n => n.nutrientName === 'Total lipid (fat)')?.value;

    let summary = [];
    if (energy !== undefined) summary.push(`Cal: ${energy.toFixed(0)}`);
    if (protein !== undefined) summary.push(`P: ${protein.toFixed(1)}g`);
    if (carbs !== undefined) summary.push(`C: ${carbs.toFixed(1)}g`);
    if (fat !== undefined) summary.push(`F: ${fat.toFixed(1)}g`);

    return summary.join(' | ');
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {/* This button will be placed in the parent page */}
        <Button variant="secondary">
            <Search className="mr-2 h-4 w-4" /> Import Food (USDA)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Import Food from USDA Database</DialogTitle>
          <DialogDescription>
            Search the USDA FoodData Central database and import items into your library.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center space-x-2">
            <Input
              id="usda-search"
              placeholder="e.g., 'apple', 'chicken breast', 'cheerios'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              disabled={isSearchPending || isImportPending}
            />
            <Button onClick={handleSearch} disabled={isSearchPending || isImportPending || query.trim().length < 3}>
              {isSearchPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          {searchStatus === 'error' && searchError && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md flex items-center gap-1">
              <AlertCircle className="h-4 w-4" /> {searchError}
            </p>
          )}
           {importStatus === 'error' && importResult?.error && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md flex items-center gap-1">
              <AlertCircle className="h-4 w-4" /> Import failed: {importResult.error}
            </p>
          )}
           {importStatus === 'success' && importResult?.message && (
            <p className="text-sm text-green-700 bg-green-100 p-2 rounded-md flex items-center gap-1">
              <CheckCircle className="h-4 w-4" /> {importResult.message}
            </p>
          )}

          {searchStatus === 'loading' && (
            <div className="flex justify-center items-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Searching...</span>
            </div>
          )}

          {searchStatus === 'success' && searchResults.length === 0 && (
            <p className="text-center text-muted-foreground p-4">No results found for "{query}".</p>
          )}

          {searchStatus === 'success' && searchResults.length > 0 && (
            <ScrollArea className="h-[300px] w-full rounded-md border p-2">
               <div className="space-y-2">
                {searchResults.map((food) => (
                  <div key={food.fdcId} className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50">
                    <div>
                      <p className="font-medium">{food.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {food.brandOwner ? `${food.brandOwner} | ` : ''}
                        {food.dataType} | FDC ID: {food.fdcId}
                      </p>
                       <p className="text-xs text-muted-foreground mt-1">{renderNutrientSummary(food)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleImportClick(food.fdcId)}
                      disabled={isImportPending || importStatus === 'loading'}
                      title={`Add ${food.description} to library`}
                    >
                      {isImportPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-1 h-4 w-4" />}
                      Add
                    </Button>
                  </div>
                ))}
               </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isImportPending}>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
