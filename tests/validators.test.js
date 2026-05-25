import { describe, it, expect } from 'vitest'
import {
  productSchema,
  reviewSchema,
  checkoutSchema,
  onboardingSchema,
  sellerActivationSchema,
} from '../validators/index.js'

describe('Validators', () => {
  describe('productSchema', () => {
    const validProduct = {
      title: 'Libro de cálculo',
      description: 'Libro usado en buen estado',
      price: 50000,
      category: 'Libros',
      condition: 'nuevo',
    }

    it('accepts valid product', () => {
      const result = productSchema.safeParse(validProduct)
      expect(result.success).toBe(true)
    })

    it('rejects missing title', () => {
      const result = productSchema.safeParse({ ...validProduct, title: '' })
      expect(result.success).toBe(false)
    })

    it('rejects negative price', () => {
      const result = productSchema.safeParse({ ...validProduct, price: -100 })
      expect(result.success).toBe(false)
    })

    it('rejects invalid condition', () => {
      const result = productSchema.safeParse({ ...validProduct, condition: 'Usado' })
      expect(result.success).toBe(false)
    })
  })

  describe('reviewSchema', () => {
    it('accepts valid review with order_id', () => {
      const result = reviewSchema.safeParse({ rating: 4, comment: 'Buen producto', order_id: 'order-1' })
      expect(result.success).toBe(true)
    })

    it('accepts valid review with product_id', () => {
      const result = reviewSchema.safeParse({ rating: 4, comment: 'Buen producto', product_id: 'prod-1' })
      expect(result.success).toBe(true)
    })

    it('accepts review without comment', () => {
      const result = reviewSchema.safeParse({ rating: 3, order_id: 'order-1' })
      expect(result.success).toBe(true)
    })

    it('rejects rating below 1', () => {
      const result = reviewSchema.safeParse({ rating: 0, comment: 'Malo', order_id: 'order-1' })
      expect(result.success).toBe(false)
    })

    it('rejects rating above 5', () => {
      const result = reviewSchema.safeParse({ rating: 6, comment: 'Excelente', order_id: 'order-1' })
      expect(result.success).toBe(false)
    })

    it('rejects missing order_id and product_id', () => {
      const result = reviewSchema.safeParse({ rating: 3 })
      expect(result.success).toBe(false)
    })
  })

  describe('checkoutSchema', () => {
    it('accepts valid checkout with all fields', () => {
      const result = checkoutSchema.safeParse({
        payment_method: 'credit_card',
        bank_name: 'Bancolombia',
        shipping_address: 'Calle 123 #45-67',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing shipping_address', () => {
      const result = checkoutSchema.safeParse({
        payment_method: 'credit_card',
        bank_name: 'Bancolombia',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing bank_name', () => {
      const result = checkoutSchema.safeParse({
        payment_method: 'bank_transfer',
        shipping_address: 'Calle 123',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('onboardingSchema', () => {
    it('accepts valid onboarding', () => {
      const result = onboardingSchema.safeParse({
        full_name: 'Test User',
        bio: 'Estudiante',
        academic_info: { is_student: true, career: 'Ingeniería', faculty: 'Ingeniería' },
      })
      expect(result.success).toBe(true)
    })

    it('accepts basic onboarding without academic_info', () => {
      const result = onboardingSchema.safeParse({
        full_name: 'Test User',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty full_name', () => {
      const result = onboardingSchema.safeParse({ full_name: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('sellerActivationSchema', () => {
    it('accepts valid seller activation', () => {
      const result = sellerActivationSchema.safeParse({
        accept_selling_policies: true,
        seller_type: 'individual',
        store_name: 'Mi Tienda',
      })
      expect(result.success).toBe(true)
    })

    it('accepts business seller', () => {
      const result = sellerActivationSchema.safeParse({
        accept_selling_policies: true,
        seller_type: 'business',
        store_name: 'Tienda Business',
      })
      expect(result.success).toBe(true)
    })

    it('rejects when policies not accepted', () => {
      const result = sellerActivationSchema.safeParse({
        accept_selling_policies: false,
        seller_type: 'individual',
        store_name: 'Tienda',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid seller_type', () => {
      const result = sellerActivationSchema.safeParse({
        accept_selling_policies: true,
        seller_type: 'alumni',
        store_name: 'Tienda',
      })
      expect(result.success).toBe(false)
    })
  })
})
