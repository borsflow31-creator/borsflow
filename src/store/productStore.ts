import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/types';

interface ProductState {
  products: Product[];
  currentProduct: Product | null;
  setCurrentProduct: (product: Product | null) => void;
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  productsViewMode: 'grid' | 'table';
  setProductsViewMode: (mode: 'grid' | 'table') => void;
  productsSearchQuery: string;
  setProductsSearchQuery: (query: string) => void;
  productsCategoryFilter: string;
  setProductsCategoryFilter: (category: string) => void;
  productsActiveFilter: string;
  setProductsActiveFilter: (filter: string) => void;
}

export const useProductStore = create<ProductState>()(
  persist(
    (set) => ({
      products: [],
      currentProduct: null,
      setCurrentProduct: (product) => set({ currentProduct: product }),
      setProducts: (products) => set({ products }),
      addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
      updateProduct: (id, updatedProduct) =>
        set((state) => ({
          products: state.products.map((product) =>
            product.id === id ? { ...product, ...updatedProduct } : product
          ),
          currentProduct:
            state.currentProduct?.id === id
              ? { ...state.currentProduct, ...updatedProduct }
              : state.currentProduct,
        })),
      deleteProduct: (id) =>
        set((state) => ({
          products: state.products.filter((product) => product.id !== id),
          currentProduct: state.currentProduct?.id === id ? null : state.currentProduct,
        })),
      productsViewMode: 'grid',
      setProductsViewMode: (mode) => set({ productsViewMode: mode }),
      productsSearchQuery: '',
      setProductsSearchQuery: (query) => set({ productsSearchQuery: query }),
      productsCategoryFilter: 'all',
      setProductsCategoryFilter: (category) => set({ productsCategoryFilter: category }),
      productsActiveFilter: 'all',
      setProductsActiveFilter: (filter) => set({ productsActiveFilter: filter }),
    }),
    {
      name: 'product-storage',
      partialize: (state) => ({
        productsViewMode: state.productsViewMode,
      }),
    }
  )
);
