import { StyleSheet } from 'react-native'

export const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    overflow: 'hidden',
  },
  titleCol: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '800',
  },
  valueArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  number: {
    fontWeight: '900',
  },
  unit: {},
})
