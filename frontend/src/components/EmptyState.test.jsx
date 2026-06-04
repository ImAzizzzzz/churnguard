import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No data" description="Nothing here yet" />)
    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
  })

  it('renders and fires the action button', () => {
    const onClick = vi.fn()
    render(<EmptyState title="Empty" action={onClick} actionLabel="Retry" />)
    fireEvent.click(screen.getByText('Retry'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('omits the action button when no actionLabel', () => {
    render(<EmptyState title="Empty" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
