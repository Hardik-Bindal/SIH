import { create } from 'zustand'

// Global filter state shared across pages via the top bar (site/area/date
// range). Individual pages opt in to whichever slices are relevant to them —
// nothing forces every page to honour every filter.
export const useFilterStore = create((set) => ({
  site: '',
  area: '',
  department: '',
  dateFrom: '',
  dateTo: '',
  setSite: (site) => set({ site }),
  setArea: (area) => set({ area }),
  setDepartment: (department) => set({ department }),
  setDateFrom: (dateFrom) => set({ dateFrom }),
  setDateTo: (dateTo) => set({ dateTo }),
  reset: () => set({ site: '', area: '', department: '', dateFrom: '', dateTo: '' }),
}))

export const AREAS = ['RIG', 'REFINERY', 'PIPELINE', 'WAREHOUSE', 'WORKSHOP']
export const RISK_BANDS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']