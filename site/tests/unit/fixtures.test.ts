import { describe, it, expect } from 'vitest'
import { parseGridKey } from '../../src/data/fixtures'

describe('builder chip parsing', () => {
  it('never invents a status filter the key does not have', () => {
    expect(parseGridKey('revenue_by_month_completed')).toEqual({ key: 'revenue_by_month_completed', dimension: 'month', aggregate: 'revenue', statusFilter: 'completed' })
    expect(parseGridKey('customers_by_city')).toEqual({ key: 'customers_by_city', dimension: 'city', aggregate: 'customers', statusFilter: null })
    expect(parseGridKey('orders_by_status')).toEqual({ key: 'orders_by_status', dimension: 'status', aggregate: 'orders', statusFilter: null })
  })
})
