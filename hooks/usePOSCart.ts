import { useState, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { Product } from '../database/schema';

export interface CartItem {
  id: number;
  code: string;
  name: string;
  price: number;
  cost: number;
  quantity: number;
  vat_type: 'vatable' | 'vat_exempt' | 'zero_rated';
  tax_rate: number;
  is_vat_inclusive: boolean;
  stock_quantity: number;
}

export interface CartTotals {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  grossTotal: number;  // Total before discount (what customer sees as item prices sum)
  itemCount: number;
  // BIR VAT breakdown
  vatableSales: number;
  vatExemptSales: number;
  zeroRatedSales: number;
  vatAmount: number;
}

export interface DiscountState {
  type: 'none' | 'percent' | 'amount' | 'senior';
  value: string;
  isSeniorCitizen: boolean;
  // Senior Citizen discount details
  totalCustomers: number;
  seniorCount: number;
}

interface UsePOSCartReturn {
  cart: CartItem[];
  totals: CartTotals;
  discount: DiscountState;
  addItem: (product: Product) => boolean;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => boolean;
  incrementQuantity: (productId: number) => void;
  decrementQuantity: (productId: number) => void;
  clearCart: () => void;
  setDiscountType: (type: DiscountState['type']) => void;
  setDiscountValue: (value: string) => void;
  toggleSeniorCitizen: () => void;
  setSeniorDiscount: (totalCustomers: number, seniorCount: number) => void;
  clearSeniorDiscount: () => void;
  getItemQuantity: (productId: number) => number;
}

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

export function usePOSCart(): UsePOSCartReturn {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<DiscountState>({
    type: 'none',
    value: '',
    isSeniorCitizen: false,
    totalCustomers: 1,
    seniorCount: 0,
  });

  // Add item to cart
  const addItem = useCallback((product: Product): boolean => {
    const existingItem = cart.find(item => item.id === product.id);
    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const availableStock = product.stock_quantity || 0;

    // Check stock
    if (currentQuantity + 1 > availableStock) {
      Alert.alert(
        'Insufficient Stock',
        `Only ${availableStock} units of "${product.name}" available.${currentQuantity > 0 ? ` You already have ${currentQuantity} in cart.` : ''}`
      );
      return false;
    }

    if (existingItem) {
      setCart(prevCart =>
        prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart(prevCart => [
        ...prevCart,
        {
          id: product.id,
          code: product.code,
          name: product.name,
          price: product.price,
          cost: product.cost || 0,
          quantity: 1,
          vat_type: (product.vat_type || 'vatable') as 'vatable' | 'vat_exempt' | 'zero_rated',
          tax_rate: product.tax_rate,
          is_vat_inclusive: product.is_vat_inclusive,
          stock_quantity: product.stock_quantity,
        },
      ]);
    }
    return true;
  }, [cart]);

  // Remove item from cart
  const removeItem = useCallback((productId: number): void => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  }, []);

  // Update item quantity
  const updateQuantity = useCallback((productId: number, quantity: number): boolean => {
    if (quantity <= 0) {
      removeItem(productId);
      return true;
    }

    const item = cart.find(i => i.id === productId);
    if (item && quantity > item.stock_quantity) {
      Alert.alert(
        'Insufficient Stock',
        `Only ${item.stock_quantity} units of "${item.name}" available.`
      );
      return false;
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
    return true;
  }, [cart, removeItem]);

  // Increment quantity
  const incrementQuantity = useCallback((productId: number): void => {
    const item = cart.find(i => i.id === productId);
    if (item) {
      updateQuantity(productId, item.quantity + 1);
    }
  }, [cart, updateQuantity]);

  // Decrement quantity
  const decrementQuantity = useCallback((productId: number): void => {
    const item = cart.find(i => i.id === productId);
    if (item) {
      updateQuantity(productId, item.quantity - 1);
    }
  }, [cart, updateQuantity]);

  // Clear cart
  const clearCart = useCallback((): void => {
    setCart([]);
    setDiscount({ type: 'none', value: '', isSeniorCitizen: false, totalCustomers: 1, seniorCount: 0 });
  }, []);

  // Set discount type
  const setDiscountType = useCallback((type: DiscountState['type']): void => {
    setDiscount(prev => ({
      ...prev,
      type,
      value: '',
      isSeniorCitizen: type === 'senior',
    }));
  }, []);

  // Set discount value
  const setDiscountValue = useCallback((value: string): void => {
    // Only allow valid numeric input
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const sanitized = parts.length > 2
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;

    // For percent, limit to 100
    if (discount.type === 'percent') {
      const num = parseFloat(sanitized);
      if (!isNaN(num) && num > 100) {
        setDiscount(prev => ({ ...prev, value: '100' }));
        return;
      }
    }

    setDiscount(prev => ({ ...prev, value: sanitized }));
  }, [discount.type]);

  // Toggle senior citizen discount (legacy - use setSeniorDiscount instead)
  const toggleSeniorCitizen = useCallback((): void => {
    setDiscount(prev => ({
      type: prev.isSeniorCitizen ? 'none' : 'senior',
      value: '',
      isSeniorCitizen: !prev.isSeniorCitizen,
      totalCustomers: prev.isSeniorCitizen ? 1 : prev.totalCustomers,
      seniorCount: prev.isSeniorCitizen ? 0 : prev.seniorCount,
    }));
  }, []);

  // Set senior citizen discount with customer counts
  const setSeniorDiscount = useCallback((totalCustomers: number, seniorCount: number): void => {
    if (seniorCount > 0 && totalCustomers >= seniorCount) {
      setDiscount({
        type: 'senior',
        value: '',
        isSeniorCitizen: true,
        totalCustomers,
        seniorCount,
      });
    }
  }, []);

  // Clear senior citizen discount
  const clearSeniorDiscount = useCallback((): void => {
    setDiscount({
      type: 'none',
      value: '',
      isSeniorCitizen: false,
      totalCustomers: 1,
      seniorCount: 0,
    });
  }, []);

  // Get quantity of specific item in cart
  const getItemQuantity = useCallback((productId: number): number => {
    const item = cart.find(i => i.id === productId);
    return item ? item.quantity : 0;
  }, [cart]);

  // Calculate totals
  const totals = useMemo((): CartTotals => {
    let subtotal = 0;
    let taxAmount = 0;
    let itemCount = 0;
    let vatableSales = 0;
    let vatExemptSales = 0;
    let zeroRatedSales = 0;
    let vatAmount = 0;
    let grossTotal = 0;  // Sum of item prices (what customer sees)

    cart.forEach(item => {
      const itemTotal = roundCurrency(item.price * item.quantity);
      grossTotal += itemTotal;  // Always add the displayed price
      itemCount += item.quantity;

      // Calculate based on VAT type
      if (item.vat_type === 'vatable') {
        // VATable items - 12% VAT
        if (item.is_vat_inclusive) {
          // Price includes VAT - extract the VAT-exclusive amount
          const vatExclusive = roundCurrency(itemTotal / 1.12);
          const itemVat = roundCurrency(itemTotal - vatExclusive);
          vatableSales += vatExclusive;
          vatAmount += itemVat;
          subtotal += vatExclusive;
          taxAmount += itemVat;
        } else {
          // Price excludes VAT - calculate VAT on top
          const itemVat = roundCurrency(itemTotal * 0.12);
          vatableSales += itemTotal;
          vatAmount += itemVat;
          subtotal += itemTotal;
          taxAmount += itemVat;
        }
      } else if (item.vat_type === 'vat_exempt') {
        // VAT-Exempt items - no VAT
        vatExemptSales += itemTotal;
        subtotal += itemTotal;
      } else {
        // Zero-Rated items - no VAT (but technically 0% rated)
        zeroRatedSales += itemTotal;
        subtotal += itemTotal;
      }
    });

    subtotal = roundCurrency(subtotal);
    taxAmount = roundCurrency(taxAmount);
    vatableSales = roundCurrency(vatableSales);
    vatExemptSales = roundCurrency(vatExemptSales);
    zeroRatedSales = roundCurrency(zeroRatedSales);
    vatAmount = roundCurrency(vatAmount);
    grossTotal = roundCurrency(grossTotal);

    const totalBeforeDiscount = roundCurrency(subtotal + taxAmount);
    let discountAmount = 0;

    // Calculate discount
    if (discount.isSeniorCitizen && discount.seniorCount > 0) {
      // Senior Citizen/PWD: Per-person calculation for group dining
      // Formula:
      // 1. Calculate per-person share
      // 2. Apply 20% discount only on senior's VAT-exclusive portion
      // 3. VAT exemption only applies to senior's portion

      const totalCustomers = Math.max(1, discount.totalCustomers);
      const seniorCount = Math.min(discount.seniorCount, totalCustomers);
      const nonSeniorCount = totalCustomers - seniorCount;

      // Per-person share of VAT-exclusive subtotal
      const perPersonSubtotal = subtotal / totalCustomers;
      // Per-person share of VAT
      const perPersonVat = vatAmount / totalCustomers;

      // Senior portion calculations
      const seniorSubtotal = roundCurrency(perPersonSubtotal * seniorCount);
      const seniorVat = roundCurrency(perPersonVat * seniorCount);

      // Non-senior portion (keeps VAT)
      const nonSeniorSubtotal = roundCurrency(perPersonSubtotal * nonSeniorCount);
      const nonSeniorVat = roundCurrency(perPersonVat * nonSeniorCount);

      // Senior discount: 20% of senior's VAT-exclusive amount
      discountAmount = roundCurrency(seniorSubtotal * 0.20);

      // Update tax - seniors are VAT exempt, non-seniors pay VAT
      taxAmount = nonSeniorVat;
      vatAmount = nonSeniorVat;

    } else if (discount.type === 'percent' && discount.value) {
      const percentValue = parseFloat(discount.value);
      if (!isNaN(percentValue) && percentValue >= 0 && percentValue <= 100) {
        discountAmount = roundCurrency((totalBeforeDiscount * percentValue) / 100);
      }
    } else if (discount.type === 'amount' && discount.value) {
      const amountValue = parseFloat(discount.value);
      if (!isNaN(amountValue) && amountValue >= 0) {
        discountAmount = roundCurrency(Math.min(amountValue, totalBeforeDiscount));
      }
    }

    const total = roundCurrency(Math.max(0, totalBeforeDiscount - discountAmount));

    return {
      subtotal,
      taxAmount,
      discountAmount,
      total,
      grossTotal,
      itemCount,
      vatableSales,
      vatExemptSales,
      zeroRatedSales,
      vatAmount,
    };
  }, [cart, discount]);

  return {
    cart,
    totals,
    discount,
    addItem,
    removeItem,
    updateQuantity,
    incrementQuantity,
    decrementQuantity,
    clearCart,
    setDiscountType,
    setDiscountValue,
    toggleSeniorCitizen,
    setSeniorDiscount,
    clearSeniorDiscount,
    getItemQuantity,
  };
}

export default usePOSCart;
