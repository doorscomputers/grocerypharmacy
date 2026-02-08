import { useState, useEffect, useCallback, useMemo } from 'react';
import { getDatabase } from '../database/getDatabase';
import { Product, Category } from '../database/schema';

interface UsePOSProductsReturn {
  products: Product[];
  categories: Category[];
  searchQuery: string;
  selectedCategory: number | null;
  filteredProducts: Product[];
  loading: boolean;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (categoryId: number | null) => void;
  refreshProducts: () => Promise<void>;
  findProductByBarcode: (barcode: string) => Product | undefined;
}

export function usePOSProducts(): UsePOSProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Load products from database
  const loadProducts = useCallback(async () => {
    try {
      const dbService = getDatabase();
      const productList = await dbService.getProducts(true, 500);
      setProducts(productList as Product[]);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }, []);

  // Load categories from database
  const loadCategories = useCallback(async () => {
    try {
      const dbService = getDatabase();
      const categoryList = await dbService.getCategories(true);
      setCategories(categoryList as Category[]);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadProducts(), loadCategories()]);
      setLoading(false);
    };
    init();
  }, [loadProducts, loadCategories]);

  // Refresh products
  const refreshProducts = useCallback(async () => {
    setLoading(true);
    await loadProducts();
    setLoading(false);
  }, [loadProducts]);

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    // First, exclude products with zero or negative stock
    let filtered = products.filter(p => (p.stock_quantity || 0) > 0);

    // Filter by category
    if (selectedCategory !== null) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();

      // First try exact code match (for barcodes)
      const exactMatch = filtered.filter(p => (p.code || '').toLowerCase() === query);
      if (exactMatch.length > 0) {
        return exactMatch;
      }

      // Otherwise do contains search on name and code
      filtered = filtered.filter(p => {
        const name = (p.name || '').toLowerCase();
        const code = (p.code || '').toLowerCase();
        return name.includes(query) || code.includes(query);
      });
    }

    return filtered;
  }, [products, searchQuery, selectedCategory]);

  // Find product by barcode (case-insensitive match)
  const findProductByBarcode = useCallback((barcode: string): Product | undefined => {
    const barcodeUpper = barcode.toUpperCase().trim();
    return products.find(p => (p.code || '').toUpperCase().trim() === barcodeUpper);
  }, [products]);

  // Update search query with validation
  const handleSetSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Update selected category
  const handleSetSelectedCategory = useCallback((categoryId: number | null) => {
    setSelectedCategory(categoryId);
  }, []);

  return {
    products,
    categories,
    searchQuery,
    selectedCategory,
    filteredProducts,
    loading,
    setSearchQuery: handleSetSearchQuery,
    setSelectedCategory: handleSetSelectedCategory,
    refreshProducts,
    findProductByBarcode,
  };
}

export default usePOSProducts;
