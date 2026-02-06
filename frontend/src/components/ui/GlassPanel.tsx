import { forwardRef } from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface GlassPanelProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'light' | 'dark' | 'interactive' | 'ai-active' | 'success' | 'warning' | 'error'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  blur?: 'sm' | 'md' | 'lg'
  glowing?: boolean
}

const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  (
    {
      className,
      variant = 'default',
      padding = 'md',
      blur = 'md',
      glowing = false,
      children,
      ...props
    },
    ref
  ) => {
    const blurValues = {
      sm: 'backdrop-blur-sm',
      md: 'backdrop-blur-glass',
      lg: 'backdrop-blur-xl',
    }

    const variants = {
      default: cn(
        'bg-white/72 border border-white/18 rounded-2xl',
        blurValues[blur]
      ),
      light: cn(
        'bg-white/45 border border-white/20 rounded-2xl',
        blurValues[blur]
      ),
      dark: cn(
        'bg-grey-900/72 border border-white/8 rounded-2xl text-white',
        blurValues[blur]
      ),
      interactive: cn(
        'bg-white/72 border border-white/18 rounded-2xl',
        blurValues[blur],
        'transition-all duration-normal ease-out-expo',
        'hover:bg-white/85 hover:shadow-elevated',
        'cursor-pointer'
      ),
      'ai-active': cn(
        'bg-white/72 border-2 border-blue-400/40 rounded-2xl',
        blurValues[blur],
        'ring-1 ring-blue-400/20',
        'shadow-[0_0_15px_rgba(59,130,246,0.15)]'
      ),
      success: cn(
        'bg-green-50/80 border border-green-200/50 rounded-2xl',
        blurValues[blur]
      ),
      warning: cn(
        'bg-amber-50/80 border border-amber-200/50 rounded-2xl',
        blurValues[blur]
      ),
      error: cn(
        'bg-red-50/80 border border-red-200/50 rounded-2xl',
        blurValues[blur]
      ),
    }

    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    }

    // Motion props based on variant
    const getMotionProps = () => {
      if (variant === 'interactive') {
        return {
          whileHover: { y: -1, scale: 1.005 },
          whileTap: { scale: 0.995 },
          transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
        }
      }

      if (variant === 'ai-active' && glowing) {
        return {
          animate: {
            boxShadow: [
              '0 0 15px rgba(59, 130, 246, 0.15)',
              '0 0 25px rgba(59, 130, 246, 0.25)',
              '0 0 15px rgba(59, 130, 246, 0.15)',
            ],
          },
          transition: {
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          },
        }
      }

      return {}
    }

    return (
      <motion.div
        ref={ref}
        className={cn(variants[variant], paddings[padding], className)}
        {...getMotionProps()}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)

GlassPanel.displayName = 'GlassPanel'

export { GlassPanel }
