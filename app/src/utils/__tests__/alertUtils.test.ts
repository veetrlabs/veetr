import { Alert } from 'react-native'
import { showSingleAlert, resetAlertFlag, isAlertInProgress } from '../alertUtils'

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
}))

beforeEach(() => {
  jest.clearAllMocks()
  resetAlertFlag()
})

describe('showSingleAlert', () => {
  it('calls Alert.alert with title and message', () => {
    showSingleAlert('Something went wrong', 'Error')
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Something went wrong', expect.any(Array))
  })

  it('uses default title "Error"', () => {
    showSingleAlert('Something went wrong')
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Something went wrong', expect.any(Array))
  })

  it('does not show duplicate alerts within 10 seconds', () => {
    showSingleAlert('Something went wrong')
    showSingleAlert('Something went wrong')
    expect(Alert.alert).toHaveBeenCalledTimes(1)
  })

  it('shows alert again after state is reset', () => {
    showSingleAlert('Something went wrong')
    expect(Alert.alert).toHaveBeenCalledTimes(1)

    resetAlertFlag()
    showSingleAlert('Something went wrong')

    expect(Alert.alert).toHaveBeenCalledTimes(2)
  })

  it('shows alert with different message even within 10 seconds', () => {
    showSingleAlert('First error')
    resetAlertFlag()
    showSingleAlert('Second error')
    expect(Alert.alert).toHaveBeenCalledTimes(2)
  })
})

describe('isAlertInProgress', () => {
  it('returns false initially', () => {
    expect(isAlertInProgress()).toBe(false)
  })

  it('returns false after reset', () => {
    showSingleAlert('test')
    resetAlertFlag()
    expect(isAlertInProgress()).toBe(false)
  })
})
