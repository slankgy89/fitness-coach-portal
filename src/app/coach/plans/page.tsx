'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch'; // Import Switch
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EditPlanDialog } from './EditPlanDialog';
import { Pencil, ChevronDown, Star } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { toast } from 'sonner'; // Import toast

// Define Plan type
type CoachPlan = {
  id: string;
  coach_id: string;
  stripe_product_id: string;
  stripe_price_id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  interval: 'day' | 'week' | 'month' | 'year';
  interval_count: number;
  features: string[] | null;
  is_active: boolean;
  is_publicly_featured?: boolean; // Added field
  created_at: string;
  updated_at: string;
};

// --- Main Page Content ---
function CoachPlansContent() {
  const supabase = createClient();
  const [plans, setPlans] = useState<CoachPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Used for create/bulk actions
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());

  const [newPlanData, setNewPlanData] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'usd',
    interval: 'month' as CoachPlan['interval'],
    interval_count: '1',
    features: '',
  });

  // Fetch Plans Logic
  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoading(true); setError(null);
      try {
        const response = await fetch('/api/coach/plans');
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch plans');
        const data = await response.json();
        const formattedPlans = (data.plans || []).map((plan: any) => ({
            ...plan,
            is_publicly_featured: !!plan.is_publicly_featured
        }));
        setPlans(formattedPlans);
      } catch (err: any) { setError(err.message); }
      finally { setIsLoading(false); }
    };
    fetchPlans();
  }, []);

  // Input Handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
     const { name, value } = e.target;
     if (name === 'interval_count') {
         const numValue = parseInt(value, 10);
         if (value === '' || (!isNaN(numValue) && numValue > 0)) {
              setNewPlanData(prev => ({ ...prev, [name]: value }));
         } else if (!isNaN(numValue) && numValue <= 0) {
              setNewPlanData(prev => ({ ...prev, [name]: value }));
         }
     } else {
         setNewPlanData(prev => ({ ...prev, [name]: value }));
     }
   };
   const handleSelectChange = (name: string, value: string) => {
      if (name === 'interval') {
         setNewPlanData(prev => ({ ...prev, [name]: value as CoachPlan['interval'] }));
      } else {
         setNewPlanData(prev => ({ ...prev, [name]: value }));
      }
   };

  // Create Plan Handler
  const handleCreatePlan = async (e: React.FormEvent) => {
     e.preventDefault(); setIsSubmitting(true); setError(null);
     const priceInCents = Math.round(parseFloat(newPlanData.price) * 100);
     const intervalCount = parseInt(newPlanData.interval_count, 10);
     if (isNaN(priceInCents) || priceInCents <= 0) { setError("Invalid price."); setIsSubmitting(false); return; }
     if (isNaN(intervalCount) || intervalCount <= 0) { setError("Invalid interval count."); setIsSubmitting(false); return; }
     const featuresArray = newPlanData.features.split(',').map(f => f.trim()).filter(f => f);
     try {
       const response = await fetch('/api/coach/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newPlanData.name, description: newPlanData.description, price: priceInCents, currency: newPlanData.currency, interval: newPlanData.interval, interval_count: intervalCount, features: featuresArray.length > 0 ? featuresArray : null, }), });
       if (!response.ok) throw new Error((await response.json()).error || 'Failed to create plan');
       const data = await response.json();
       setPlans(prev => [{...data.plan, is_publicly_featured: !!data.plan.is_publicly_featured}, ...prev]);
       setIsCreateDialogOpen(false);
       setNewPlanData({ name: '', description: '', price: '', currency: 'usd', interval: 'month', interval_count: '1', features: '' });
     } catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
   };

  // Toggle Active Handler
   const handleToggleActive = async (plan: CoachPlan) => {
      // Avoid toggling if another action is in progress
      // Note: We might need separate loading states per plan for better UX
      if (isSubmitting) return; 
      try {
        const response = await fetch(`/api/coach/plans/${plan.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !plan.is_active }), });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to update status');
        const data = await response.json();
        setPlans(prev => prev.map(p => p.id === plan.id ? {...data.plan, is_publicly_featured: !!data.plan.is_publicly_featured} : p));
      } catch (err: any) { console.error("Error toggling active:", err); toast.error(`Error: ${err.message}`); }
    };

  // Toggle Featured Handler
   const handleToggleFeatured = async (plan: CoachPlan) => {
      if (isSubmitting) return;
      try {
        const response = await fetch(`/api/coach/plans/${plan.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_publicly_featured: !plan.is_publicly_featured }), });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to update status');
        const data = await response.json();
        setPlans(prev => prev.map(p => p.id === plan.id ? {...data.plan, is_publicly_featured: !!data.plan.is_publicly_featured} : p));
        toast.success(`Plan "${plan.name}" ${data.plan.is_publicly_featured ? 'featured' : 'unfeatured'}.`);
      } catch (err: any) { console.error("Error toggling featured:", err); toast.error(`Error: ${err.message}`); }
    };

  // Bulk Action Handlers
   const activePlans = plans.filter(plan => plan.is_active); // Filter active plans for bulk actions
   const handleSelectAll = (checked: boolean | 'indeterminate') => {
        setSelectedPlanIds(checked === true ? new Set(activePlans.map(p => p.id)) : new Set());
    };
    const handlePlanSelect = (planId: string, checked: boolean | 'indeterminate') => {
        setSelectedPlanIds(prev => { const next = new Set(prev); if (checked === true) next.add(planId); else next.delete(planId); return next; });
    };
    const handleBulkDeactivate = async () => {
        const idsToDeactivate = activePlans.filter(p => selectedPlanIds.has(p.id)).map(p => p.id);
        if (idsToDeactivate.length === 0) return;
        setIsSubmitting(true); setError(null);
        try {
            const response = await fetch('/api/coach/plans', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planIds: idsToDeactivate }), });
            if (!response.ok) throw new Error((await response.json()).error || 'Failed to deactivate');
            const result = await response.json();
            setPlans(prevPlans => prevPlans.map(p => result.deactivated?.includes(p.id) ? { ...p, is_active: false } : p));
            setSelectedPlanIds(new Set());
            toast.success(`${result.deactivated?.length || 0} plan(s) deactivated.`);
        } catch (err: any) { console.error("Bulk Deactivate Error:", err); toast.error(`Error: ${err.message}`); } finally { setIsSubmitting(false); }
    };

  // Plan Update Callback
   const handlePlanUpdated = (updatedPlan: CoachPlan) => {
        setPlans(prevPlans => prevPlans.map(p => p.id === updatedPlan.id ? {...updatedPlan, is_publicly_featured: !!updatedPlan.is_publicly_featured} : p));
    };

  // Filter Plans for display
  const inactivePlans = plans.filter(plan => !plan.is_active);

  // Helper function to render a plan item (to avoid repetition)
  const renderPlanItem = (plan: CoachPlan, isInactiveSection = false) => (
     <div key={plan.id} className={`flex items-center justify-between p-4 border rounded-lg ${isInactiveSection ? 'bg-muted/50' : 'bg-card'}`}>
       {/* Checkbox and Plan Details */}
       <div className="flex items-center space-x-4">
          {!isInactiveSection && ( // Only show checkbox for active plans if bulk actions target active
             <Checkbox
                id={`select-${plan.id}`}
                checked={selectedPlanIds.has(plan.id)}
                onCheckedChange={(checked) => handlePlanSelect(plan.id, checked)}
             />
          )}
          <div className={isInactiveSection ? 'text-muted-foreground' : ''}>
             <h3 className={`font-semibold ${isInactiveSection ? 'text-muted-foreground' : ''}`}>{plan.name}</h3>
             <p className="text-sm text-muted-foreground">
                ${(plan.price / 100).toFixed(2)} {plan.currency.toUpperCase()} /
                {plan.interval_count > 1 ? ` ${plan.interval_count}` : ''} {plan.interval}{plan.interval_count > 1 ? 's' : ''}
             </p>
             {!isInactiveSection && <p className="text-xs text-muted-foreground">Price ID: {plan.stripe_price_id}</p>}
          </div>
       </div>
       {/* Action Buttons */}
       <div className="flex items-center space-x-2">
          <EditPlanDialog plan={plan} onPlanUpdated={handlePlanUpdated}>
             <Button variant="ghost" size="sm" aria-label={`Edit plan ${plan.name}`}>
                <Pencil className="h-4 w-4" />
             </Button>
          </EditPlanDialog>
          <div className="flex items-center space-x-2 pl-2">
             <Checkbox
                id={`active-${plan.id}`}
                checked={plan.is_active}
                onCheckedChange={() => handleToggleActive(plan)}
                aria-label={`Mark plan ${plan.name} as ${plan.is_active ? 'inactive' : 'active'}`}
             />
             <Label htmlFor={`active-${plan.id}`} className={`text-sm ${isInactiveSection ? 'text-muted-foreground' : ''}`}>
                {plan.is_active ? 'Active' : 'Inactive'}
             </Label>
          </div>
          {/* Featured Toggle - Show only for Active plans */}
          {plan.is_active && (
             <div className="flex items-center space-x-2 pl-2">
                <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                   <Switch
                      id={`featured-${plan.id}`}
                      checked={!!plan.is_publicly_featured}
                      onCheckedChange={() => handleToggleFeatured(plan)}
                      aria-label={`Feature plan ${plan.name} on public pages`}
                   />
                </TooltipTrigger> <TooltipContent> <p>Feature this plan on public pages (like /pricing)</p> </TooltipContent> </Tooltip> </TooltipProvider>
                <Label htmlFor={`featured-${plan.id}`} className="text-sm">
                   <Star className={`inline-block h-4 w-4 ${plan.is_publicly_featured ? 'text-yellow-500 fill-yellow-400' : 'text-muted-foreground'}`} />
                </Label>
             </div>
          )}
       </div>
     </div>
   );


  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header & Create Button */}
      <div className="flex justify-between items-center mb-6">
         <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>Done</Link>
        <h1 className="text-3xl font-bold text-center flex-grow">Manage Your Plans</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild><Button>Create New Plan</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Create New Subscription Plan</DialogTitle></DialogHeader>
            <form onSubmit={handleCreatePlan} className="grid gap-4 py-4">
               {/* Form fields... */}
               <div className="grid grid-cols-4 items-center gap-4"> <Label htmlFor="create-name" className="text-right">Name</Label> <Input id="create-name" name="name" value={newPlanData.name} onChange={handleInputChange} required className="col-span-3" /> </div>
               <div className="grid grid-cols-4 items-center gap-4"> <Label htmlFor="create-description" className="text-right">Description</Label> <Textarea id="create-description" name="description" value={newPlanData.description} onChange={handleInputChange} className="col-span-3" /> </div>
               <div className="grid grid-cols-4 items-center gap-4"> <Label htmlFor="create-price" className="text-right">Price</Label> <Input id="create-price" name="price" type="number" step="0.01" min="0.50" value={newPlanData.price} onChange={handleInputChange} required className="col-span-3" placeholder="e.g., 49.99" /> </div>
               <div className="grid grid-cols-4 items-center gap-4"> <Label htmlFor="create-currency" className="text-right">Currency</Label> <Select name="currency" value={newPlanData.currency} onValueChange={(value) => handleSelectChange('currency', value)}> <SelectTrigger className="col-span-3"> <SelectValue placeholder="Select currency" /> </SelectTrigger> <SelectContent> <SelectItem value="usd">USD</SelectItem> <SelectItem value="cad">CAD</SelectItem> <SelectItem value="eur">EUR</SelectItem> <SelectItem value="gbp">GBP</SelectItem> </SelectContent> </Select> </div>
               <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="create-interval-count" className="text-right">Billing Cycle</Label>
                  <div className="col-span-3 grid grid-cols-2 gap-2">
                     <Input id="create-interval-count" name="interval_count" type="number" min="1" value={newPlanData.interval_count} onChange={handleInputChange} required className="w-full" placeholder="e.g., 3"/>
                     <Select name="interval" value={newPlanData.interval} onValueChange={(value) => handleSelectChange('interval', value)}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select interval" /></SelectTrigger>
                        <SelectContent><SelectItem value="day">Day(s)</SelectItem><SelectItem value="week">Week(s)</SelectItem><SelectItem value="month">Month(s)</SelectItem><SelectItem value="year">Year(s)</SelectItem></SelectContent>
                     </Select>
                  </div>
               </div>
               <div className="grid grid-cols-4 items-center gap-4"> <Label htmlFor="create-features" className="text-right">Features</Label> <Textarea id="create-features" name="features" value={newPlanData.features} onChange={handleInputChange} className="col-span-3" placeholder="Comma-separated, e.g., Feature 1, Feature 2" /> </div>
              {error && <p className="col-span-4 text-red-500 text-sm">{error}</p>}
              <DialogFooter>
                 <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                 <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Plan'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading/Error/Empty States */}
      {isLoading && <p>Loading plans...</p>}
      {!isLoading && error && <p className="text-red-500">Error loading plans: {error}</p>}
      {!isLoading && !error && plans.length === 0 && ( <p className="text-center text-muted-foreground">You haven't created any plans yet.</p> )}

      {/* Bulk Action Header (Targets Active Plans) */}
       {!isLoading && !error && activePlans.length > 0 && (
         <div className="flex justify-between items-center mb-4 px-4 py-2 border-b">
            <div className="flex items-center space-x-2">
                <Checkbox
                    id="select-all"
                    checked={selectedPlanIds.size > 0 && selectedPlanIds.size === activePlans.length}
                    onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="text-sm font-medium">Select All Active</Label>
            </div>
            <div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                   <Button variant="destructive" size="sm" disabled={selectedPlanIds.size === 0 || isSubmitting}>
                      Deactivate Selected ({selectedPlanIds.size})
                   </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will deactivate {selectedPlanIds.size} plan(s) in Stripe and mark them inactive here. Existing subscribers are not affected.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleBulkDeactivate} disabled={isSubmitting}>{isSubmitting ? 'Deactivating...' : 'Yes, Deactivate'}</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
         </div>
       )}

      {/* Active Plans List */}
      {!isLoading && !error && activePlans.length > 0 && (
        <div className="space-y-4">
          {activePlans.map((plan) => renderPlanItem(plan, false))}
        </div>
      )}

      {/* Inactive Plans Collapsible Section */}
      {!isLoading && !error && inactivePlans.length > 0 && (
        <div className="mt-8">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full flex items-center justify-between group"> {/* Added group */}
                <span>Show Inactive Plans ({inactivePlans.length})</span>
                <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              {inactivePlans.map((plan) => renderPlanItem(plan, true))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}

export default function CoachPlansPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Plans...</div>}>
      <CoachPlansContent />
    </Suspense>
  );
}
