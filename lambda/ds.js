'use strict'

export const handler = async (event, context) => {
  console.log(event)

  return [{
    id: 1,
    name: 'test',
  }]
}
