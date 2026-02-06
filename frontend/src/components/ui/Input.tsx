import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-grey-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            className={cn(
              'w-full h-10 px-3 text-sm text-grey-900 rounded-xl',
              'bg-white border border-grey-200',
              'placeholder:text-grey-400',
              'transition-all duration-fast ease-out-expo',
              'focus:outline-none focus:border-grey-400 focus:ring-2 focus:ring-grey-200',
              'disabled:bg-grey-100 disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-semantic-error focus:border-semantic-error focus:ring-semantic-error/20',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-grey-400">
              {rightIcon}
            </div>
          )}
        </div>
        {(helperText || error) && (
          <p
            className={cn(
              'mt-1.5 text-xs',
              error ? 'text-semantic-error' : 'text-grey-500'
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

// Textarea variant
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  helperText?: string
  error?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-grey-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          className={cn(
            'w-full min-h-[100px] px-3 py-2.5 text-sm text-grey-900 rounded-xl',
            'bg-white border border-grey-200',
            'placeholder:text-grey-400',
            'transition-all duration-fast ease-out-expo',
            'focus:outline-none focus:border-grey-400 focus:ring-2 focus:ring-grey-200',
            'disabled:bg-grey-100 disabled:cursor-not-allowed disabled:opacity-50',
            'resize-y',
            error && 'border-semantic-error focus:border-semantic-error focus:ring-semantic-error/20',
            className
          )}
          {...props}
        />
        {(helperText || error) && (
          <p
            className={cn(
              'mt-1.5 text-xs',
              error ? 'text-semantic-error' : 'text-grey-500'
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export { Input, Textarea }
