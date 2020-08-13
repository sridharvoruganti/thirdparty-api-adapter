/*****
 License
 --------------
 Copyright © 2020 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the 'License') and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 - Lewis Daly <lewisd@crosslaketech.com>

 --------------
 ******/

import { Util as HapiUtil } from '@hapi/hapi'
import Mustache from 'mustache'
import Logger from '@mojaloop/central-services-logger'

import {
  Enum,
  Util
} from '@mojaloop/central-services-shared'
import Config from '~/shared/config'
import { inspect } from 'util'
import { FSPIOPError, ReformatFSPIOPError } from '@mojaloop/central-services-error-handling'
import { finishChildSpan } from '~/shared/util'

export interface PostAuthorizationPayload {
  challenge: string;
  value: string;
  consentId: string;
  sourceAccountId: string;
  status: 'PENDING';
}

/**
 * @function forwardPostAuthorization
 * @description Forwards a POST /thirdpartyRequests/transactions/{ID}/authorizations request
 * @param {string} path Callback endpoint path
 * @param {HapiUtil.Dictionary<string>} headers Headers object of the request
 * @param {string} transactionRequestId the ID of the thirdpartyRequests/transactions resource
 * @param {object} payload Body of the POST request
 * @param {object} span optional request span
 * @throws {FSPIOPError} Will throw an error if no endpoint to forward the transactions requests is
 *  found, if there are network errors or if there is a bad response
 * @returns {Promise<void>}
 */
export async function forwardPostAuthorization (
  path: string,
  headers: HapiUtil.Dictionary<string>,
  transactionRequestId: string,
  payload: PostAuthorizationPayload,
  span?: any): Promise<void> {
  const childSpan = span?.getChild('forwardPostAuthorization')
  const sourceDfspId = headers[Enum.Http.Headers.FSPIOP.SOURCE]
  const destinationDfspId = headers[Enum.Http.Headers.FSPIOP.DESTINATION]
  const endpointType = Enum.EndPoints.FspEndpointTypes.THIRDPARTY_TRANSACTIONS_AUTHORIZATIONS_POST

  try {
    const endpoint = await Util.Endpoints.getEndpoint(
      Config.ENDPOINT_SERVICE_URL,
      destinationDfspId,
      endpointType
    )
    Logger.info(`authorizations::forwardPostAuthorization - Resolved destination party ${endpointType} endpoint for thirdpartyTransaction: ${transactionRequestId} to: ${inspect(endpoint)}`)
    const url: string = Mustache.render(endpoint + path, { ID: transactionRequestId })
    Logger.info(`authorizations::forwardPostAuthorization - Forwarding authorization to endpoint: ${url}`)

    await Util.Request.sendRequest(
      url,
      headers,
      sourceDfspId,
      destinationDfspId,
      Enum.Http.RestMethods.POST,
      payload,
      Enum.Http.ResponseTypes.JSON,
      childSpan
    )

    Logger.info(`authorizations::forwardPostAuthorization - Forwarded thirdpartyTransaction authorization: ${transactionRequestId} from ${sourceDfspId} to ${destinationDfspId}`)
    if (childSpan && !childSpan.isFinished) {
      childSpan.finish()
    }
  } catch (err) {
    Logger.error(`authorizations::forwardPostAuthorization - Error forwarding thirdpartyTransaction authorization to endpoint: ${inspect(err)}`)
    const errorHeaders = {
      ...headers,
      'fspiop-source': Enum.Http.Headers.FSPIOP.SWITCH.value,
      'fspiop-destination': sourceDfspId
    }
    const fspiopError: FSPIOPError = ReformatFSPIOPError(err)
    await forwardPostAuthorizationError(
      Enum.EndPoints.FspEndpointTemplates.THIRDPARTY_TRANSACTION_REQUEST_AUTHORIZATIONS_PUT_ERROR,
      errorHeaders,
      transactionRequestId,
      fspiopError.toApiErrorObject(Config.ERROR_HANDLING.includeCauseExtension, Config.ERROR_HANDLING.truncateExtensions),
      childSpan
    )

    if (childSpan && !childSpan.isFinished) {
      await finishChildSpan(fspiopError, childSpan)
    }
    throw fspiopError
  }

}

/**
 * @function forwardPostAuthorizationError
 * @description Generic function to handle sending `PUT .../authorizations/error` back to
 *   the FSPIOP-Source
 * @param {string} path Callback endpoint path
 * @param {HapiUtil.Dictionary<string>} headers Headers object of the request
 * @param {string} transactionRequestId the ID of the thirdpartyRequests/transactions resource
 * @param {object} payload Body of the POST request
 * @param {object} span optional request span
 * @throws {FSPIOPError} Will throw an error if no endpoint to forward the transactions requests is
 *  found, if there are network errors or if there is a bad response
 * @returns {Promise<void>}
 */
export async function forwardPostAuthorizationError(path: string,
  headers: HapiUtil.Dictionary<string>,
  transactionRequestId: string,
  payload: PostAuthorizationPayload,
  span?: any): Promise<void> {
  const childSpan = span?.getChild('forwardPostAuthorizationError')
  const sourceDfspId = headers[Enum.Http.Headers.FSPIOP.SOURCE]
  const destinationDfspId = headers[Enum.Http.Headers.FSPIOP.DESTINATION]
  const endpointType = Enum.EndPoints.FspEndpointTypes.THIRDPARTY_CALLBACK_URL_TRANSACTION_REQUEST_AUTHORIZATIONS_PUT_ERROR

  try {
    const endpoint = await Util.Endpoints.getEndpoint(
      Config.ENDPOINT_SERVICE_URL,
      destinationDfspId,
      endpointType)
    Logger.info(`authorizations::forwardPostAuthorizationError - Resolved destinationDfsp endpoint: ${endpointType} for transactionRequest${transactionRequestId} to: ${inspect(endpoint)}`)
    const url: string = Mustache.render(endpoint + path, { ID: transactionRequestId })
    Logger.info(`authorizations::forwardPostAuthorizationError - Forwarding thirdpartyTransaction authorization error callback to endpoint: ${url}`)

    await Util.Request.sendRequest(
      url,
      headers,
      sourceDfspId,
      destinationDfspId,
      Enum.Http.RestMethods.PUT,
      payload,
      Enum.Http.ResponseTypes.JSON,
      childSpan
    )

    Logger.info(`authorizations::forwardPostAuthorization - Forwarded thirdpartyTransaction authorization error callback: ${transactionRequestId} from ${sourceDfspId} to ${destinationDfspId}`)
    if (childSpan && !childSpan.isFinished) {
      childSpan.finish()
    }

  } catch (err) {
    Logger.error(`authorizations::forwardPostAuthorizationError - Error forwarding thirdpartyTransaction authorization error to endpoint: ${inspect(err)}`)
    const fspiopError: FSPIOPError = ReformatFSPIOPError(err)
    if (childSpan && !childSpan.isFinished) {
      await finishChildSpan(fspiopError, childSpan)
    }
    throw fspiopError
  }

}