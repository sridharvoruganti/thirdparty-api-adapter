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

 - Kevin Leyow <kevin.leyow@modusbox.com>

 --------------
 ******/
'use strict'
import { Request } from '@hapi/hapi'
import Logger from '@mojaloop/central-services-logger'
import Handler from '~/server/handlers/thirdpartyRequests/transactions/{ID}/error'
import { Transactions } from '~/domain/thirdpartyRequests'
import TestData from 'test/unit/data/mockData.json'
import { mockResponseToolkit } from 'test/unit/__mocks__/responseToolkit'

const mockForwardTransactionRequestError = jest.spyOn(Transactions, 'forwardTransactionRequestError')
const mockLoggerPush = jest.spyOn(Logger, 'push')
const mockLoggerError = jest.spyOn(Logger, 'error')
const MockData = JSON.parse(JSON.stringify(TestData))

const request: Request = MockData.genericThirdpartyError

describe('transactions error handler', (): void => {
  describe('PUT /thirdpartyRequests/transactions/{ID}/error', (): void => {
    beforeAll((): void => {
      mockLoggerPush.mockReturnValue(null)
      mockLoggerError.mockReturnValue(null)
    })

    beforeEach((): void => {
      jest.clearAllMocks()
    })

    it('handles a successful request', async (): Promise<void> => {
      mockForwardTransactionRequestError.mockResolvedValueOnce()

      const expected = [
        expect.objectContaining(request.headers),
        '/thirdpartyRequests/transactions/{{ID}}/error',
        'PUT',
        'a5bbfd51-d9fc-4084-961a-c2c2221a31e0',
        request.payload,
        undefined
      ]

      // Act
      const response = await Handler.put(null, request, mockResponseToolkit)

      // Assert
      expect(response.statusCode).toBe(200)
      expect(mockForwardTransactionRequestError).toHaveBeenCalledTimes(1)
      expect(mockForwardTransactionRequestError).toHaveBeenCalledWith(...expected)
    })

    it('handles validation errors synchronously', async (): Promise<void> => {
      // Arrange
      const badSpanRequest = {
        ...request,
        // Setting to empty span dict will cause a validation error
        span: {}
      }

      // Act
      const action = async () => await Handler.put(null, badSpanRequest as unknown as Request, mockResponseToolkit)

      // Assert
      await expect(action).rejects.toThrowError('span.setTags is not a function')
    })
  })
})
