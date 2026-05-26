import { z } from 'zod'

export const productSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres').max(120, 'El título no puede exceder 120 caracteres'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres').max(2000, 'La descripción no puede exceder 2000 caracteres'),
  price: z.coerce.number().positive('El precio debe ser un número positivo'),
  category: z.string().min(1, 'La categoría es requerida'),
  condition: z.enum(['nuevo', 'como_nuevo', 'bueno', 'aceptable'], { errorMap: () => ({ message: 'Estado inválido. Valores: nuevo, como_nuevo, bueno, aceptable' }) }),
  stock: z.coerce.number().int().min(1, 'El stock debe ser al menos 1').optional().default(1),
})

export const productUpdateSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().min(10).max(2000).optional(),
  price: z.coerce.number().positive().optional(),
  category: z.string().min(1).optional(),
  condition: z.enum(['nuevo', 'como_nuevo', 'bueno', 'aceptable']).optional(),
  stock: z.coerce.number().int().min(1).optional(),
  status: z.enum(['ACTIVO', 'INACTIVO', 'SUSPENDIDO']).optional(),
  images: z.array(z.string()).optional(),
})

export const cartItemSchema = z.object({
  product_id: z.string().min(1, 'product_id es requerido'),
  quantity: z.coerce.number().int().min(1, 'La cantidad debe ser al menos 1').optional().default(1),
})

export const orderSchema = z.object({
  items: z.array(z.object({
    product_id: z.string().min(1),
    quantity: z.coerce.number().int().min(1),
  })).optional(),
})

export const reviewSchema = z.object({
  order_id: z.string().optional(),
  product_id: z.string().optional(),
  rating: z.coerce.number().int().min(1, 'La calificación debe ser entre 1 y 5').max(5, 'La calificación debe ser entre 1 y 5'),
  comment: z.string().max(500, 'El comentario no puede exceder 500 caracteres').optional().default(''),
}).refine((data) => data.order_id || data.product_id, {
  message: 'order_id o product_id es requerido',
})

export const checkoutSchema = z.object({
  payment_method: z.string().min(1, 'El método de pago es requerido'),
  bank_name: z.string().min(1, 'El banco es requerido'),
  shipping_address: z.string().min(5, 'La dirección debe tener al menos 5 caracteres'),
  cart_id: z.string().optional(),
})

export const onboardingSchema = z.object({
  full_name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(100),
  profile_picture: z.string().optional(),
  academic_info: z.object({
    is_student: z.boolean(),
    career: z.string().optional(),
    faculty: z.string().optional(),
  }).nullish(),
  bio: z.string().max(300, 'La biografía no puede exceder 300 caracteres').optional(),
})

export const sellerActivationSchema = z.object({
  accept_selling_policies: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar las políticas de venta' }) }),
  seller_type: z.enum(['estudiante', 'egresado', 'docente', 'administrativo', 'individual', 'business'], { errorMap: () => ({ message: 'Tipo de vendedor inválido' }) }),
  store_name: z.string().min(3, 'El nombre de la tienda debe tener al menos 3 caracteres').max(60),
})

export const messageSchema = z.object({
  receiver_id: z.string().min(1, 'receiver_id es requerido'),
  content: z.string().min(1, 'El mensaje no puede estar vacío').max(2000, 'El mensaje no puede exceder 2000 caracteres'),
  product_id: z.string().optional(),
  seller_id: z.string().optional(),
})

export const orderStatusSchema = z.object({
  status: z.enum(['PAID', 'PENDIENTE', 'ENVIADO', 'ENTREGADO'], { errorMap: () => ({ message: 'Estado inválido' }) }),
})

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      console.error('[VALIDATION ERROR]', req.path, JSON.stringify(errors))
      return res.status(400).json({ status: 'error', message: 'Datos inválidos', errors })
    }
    req.body = result.data
    next()
  }
}
