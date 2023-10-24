const region = 'us-west-2'
import crypto from '@aws-crypto/sha256-js'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { SignatureV4 } from '@aws-sdk/signature-v4'
import { HttpRequest } from '@aws-sdk/protocol-http'
import { default as fetch, Request } from 'node-fetch'

const { Sha256 } = crypto

const appsyncURL = process.env.GRAPHQL_URL ?? ''

const getUser = `
  query {
    listUsers {
      items {
        id
        name
      }
    }
  }
`

const getUserId = `
  query ($user: String!) {
    usersByUser(user: $user) {
      items {
        id
      }
    }
  }
`

const invokeGql = async (query, vars) => {
  // console.log(vars)
  const endpoint = new URL(appsyncURL)

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: region,
    service: 'appsync',
    sha256: Sha256
  })

  const data = {
    query: query,
    variables: vars
  }
  console.log(data)

  const requestToBeSigned = new HttpRequest({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      host: endpoint.host
    },
    hostname: endpoint.host,
    body: JSON.stringify(data),
    path: endpoint.pathname
  })

  const signed = await signer.sign(requestToBeSigned)
  const request = new Request(endpoint, signed)

  let statusCode = 200
  let body
  let response

  try {
    response = await fetch(request)
    body = await response.json()
    if (body.errors) statusCode = 400
  } catch (error) {
    statusCode = 500
    body = {
      errors: [
        {
          message: error.message
        }
      ]
    }
  }

  return {
    statusCode,
    body: JSON.stringify(body)
  }
}

export const handler = async (event, context) => {
  console.log(event)

  /**
   * Tests basic listUsers functionality.  This should list all users in the DB
   */
  const user = await invokeGql(getUser, {})
  console.log(user)

  /**
   * Tests getUserByUser functionality.  This will ideally only return the one
   * user that is matched.  The UUID in the variables object below represents a
   * Cognito userid.  Due to existing data already in the DB I need to hold the
   * Appsync ID and the Cognito ID seperatly.  This was a way to lookup the
   * Appsync ID via the Cognito ID.
   */
  // const variables = {
  //   user: '172f89f7-96bb-4868-ae7e-6f5ac25e0ba3'
  // }
  // const userId = await invokeGql(getUserId, variables)
  // console.log(userId)
}