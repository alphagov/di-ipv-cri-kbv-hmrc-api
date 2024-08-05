import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { FetchQuestionsHandler } from "../src/fetch-questions-handler";
import { Question, QuestionsResult } from "../src/types/questions-result-types";
import { QuestionsRetrievalService } from "../src/services/questions-retrieval-service";
import { SaveQuestionsService } from "../src/services/save-questions-service";
import { FilterQuestionsService } from "../src/services/filter-questions-service";
import { MetricsProbe } from "../src/../../../lib/src/Service/metrics-probe";
import { AuditService } from "../../../lib/src/Service/audit-service";
import {
  AuditEventType,
  HmrcIvqResponse,
} from "../../../lib/src/types/audit-event";

import {
  HandlerMetric,
  CompletionStatus,
} from "../../../lib/src/MetricTypes/handler-metric-types";
import { FetchQuestionInputs } from "../src/types/fetch-question-types";

jest.mock("@aws-lambda-powertools/metrics");
jest.mock("../src/services/questions-retrieval-service");
jest.mock("../src/../../../lib/src/Service/metrics-probe");
jest.mock("../src/services/save-questions-service");
jest.mock("../src/services/filter-questions-service");
jest.mock("../src/../../../lib/src/Service/audit-service");

describe("FetchQuestionsHandler", () => {
  let fetchQuestionsHandler: FetchQuestionsHandler;
  let mockMetricsProbe: jest.MockedObjectDeep<typeof MetricsProbe>;

  let mockQuestionsRetrievalService: jest.MockedObjectDeep<
    typeof QuestionsRetrievalService
  >;

  let mockSaveQuestionsService: jest.MockedObjectDeep<
    typeof SaveQuestionsService
  >;

  let mockFilterQuestionsService: jest.MockedObjectDeep<
    typeof FilterQuestionsService
  >;

  let mockAuditService: jest.MockedObjectDeep<typeof AuditService>;

  let questionsRetrievalServiceSpy: jest.SpyInstance;
  let mockMetricsProbeSpy: jest.SpyInstance;
  let saveQuestionsServicegetExistingSavedItemSpy: jest.SpyInstance;
  let saveQuestionsServiceSaveQuestionsSpy: jest.SpyInstance;
  let filterQuestionsServiceSpy: jest.SpyInstance;
  let mockAuditServiceSpy: jest.SpyInstance;

  const mockInputEvent = {
    sessionId: "sessionId",
    sessionItem: {
      Item: {
        expiryDate: {
          N: "1234",
        },
        clientIpAddress: {
          S: "127.0.0.1",
        },
        redirectUri: {
          S: "http://localhost:8085/callback",
        },
        clientSessionId: {
          S: "2d35a412-125e-423e-835e-ca66111a38a1",
        },
        createdDate: {
          N: "1722954983024",
        },
        clientId: {
          S: "unit-test-clientid",
        },
        subject: {
          S: "urn:fdc:gov.uk:2022:6dab2b2d-5fcb-43a3-b682-9484db4a2ca5",
        },
        persistentSessionId: {
          S: "6c33f1e4-70a9-41f6-a335-7bb036edd3ca",
        },
        attemptCount: {
          N: "0",
        },
        sessionId: {
          S: "665ed4d5-7576-4c4b-84ff-99af3a57ea64",
        },
        state: {
          S: "7f42f0cc-1681-4455-872f-dd228103a12e",
        },
      },
    },
    parameters: {
      url: { value: "TEST_URL" },
      userAgent: { value: "TEST_USER_AGENT" },
    },
    bearerToken: {
      expiry: Date.now() + 7200 * 1000,
      value: "TEST_TOKEN_VALUE",
    },
    personIdentityItem: {
      nino: "TEST_NINO",
    },
  };

  const mockInputContext = {
    invokedFunctionArn: "test",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockMetricsProbe = jest.mocked(MetricsProbe);
    mockQuestionsRetrievalService = jest.mocked(QuestionsRetrievalService);
    mockSaveQuestionsService = jest.mocked(SaveQuestionsService);
    mockFilterQuestionsService = jest.mocked(FilterQuestionsService);
    mockAuditService = jest.mocked(AuditService);

    questionsRetrievalServiceSpy = jest.spyOn(
      mockQuestionsRetrievalService.prototype,
      "retrieveQuestions"
    );

    saveQuestionsServicegetExistingSavedItemSpy = jest.spyOn(
      mockSaveQuestionsService.prototype,
      "getExistingSavedItem"
    );

    filterQuestionsServiceSpy = jest.spyOn(
      mockFilterQuestionsService.prototype,
      "filterQuestions"
    );

    saveQuestionsServiceSaveQuestionsSpy = jest.spyOn(
      mockSaveQuestionsService.prototype,
      "saveQuestions"
    );

    mockMetricsProbeSpy = jest.spyOn(
      mockMetricsProbe.prototype,
      "captureMetric"
    );

    mockAuditServiceSpy = jest.spyOn(
      mockAuditService.prototype,
      "sendAuditEvent"
    );

    const SQS_AUDIT_EVENT_QUEUE_URL: string = "SQS_AUDIT_EVENT_QUEUE_URL";

    fetchQuestionsHandler = new FetchQuestionsHandler(
      mockMetricsProbe.prototype,
      mockQuestionsRetrievalService.prototype,
      mockSaveQuestionsService.prototype,
      mockFilterQuestionsService.prototype,
      mockAuditService.prototype,
      SQS_AUDIT_EVENT_QUEUE_URL
    );
  });

  describe("Success Scenarios", () => {
    it.each([
      [[]], // Zero questions
      [
        [
          new Question("rti-p60-payment-for-year", undefined, undefined),
          new Question("sa-payment-details", "2021/2022", "2020/2021"),
        ],
      ],
      [
        [
          new Question("rti-p60-payment-for-year", undefined, undefined),
          new Question("sa-payment-details", "2021/2022", "2020/2021"),
          new Question("rti-p60-statutory-adoption-pay", undefined, undefined),
        ],
      ],
    ])(
      "should return fetchQuestionsState for a valid nino when a question request is successful",
      async (questions: Question[]) => {
        const correlationId: string = "test-correlsation-id";
        const questionCount: number = questions.length;

        const mockQuestionsRetrievalServiceResponse = new QuestionsResult(
          correlationId,
          questions
        );

        questionsRetrievalServiceSpy.mockResolvedValue(
          mockQuestionsRetrievalServiceResponse
        );

        filterQuestionsServiceSpy.mockResolvedValue(questions);

        // No previously saved questions
        saveQuestionsServicegetExistingSavedItemSpy.mockResolvedValue(
          undefined
        );

        saveQuestionsServiceSaveQuestionsSpy.mockResolvedValue(true);

        const lambdaResponse = await fetchQuestionsHandler.handler(
          mockInputEvent,
          mockInputContext
        );

        const mockFetchQuestionInputs = {
          sessionId: mockInputEvent.sessionId,
          sessionTtl: Number(mockInputEvent.sessionItem.Item.expiryDate.N),
          questionsUrl: mockInputEvent.parameters.url.value,
          userAgent: mockInputEvent.parameters.userAgent.value,
          bearerToken: mockInputEvent.bearerToken.value,
          nino: mockInputEvent.personIdentityItem.nino,
          sessionItem: mockInputEvent.sessionItem,
        } as FetchQuestionInputs;

        expect(questionsRetrievalServiceSpy).toHaveBeenCalledWith(
          mockFetchQuestionInputs
        );

        expect(
          saveQuestionsServicegetExistingSavedItemSpy
        ).toHaveBeenCalledWith(mockInputEvent.sessionId);

        expect(mockMetricsProbeSpy).toHaveBeenCalledWith(
          HandlerMetric.CompletionStatus,
          MetricUnit.Count,
          CompletionStatus.OK
        );

        // Response
        let expectedState: string;
        if (questionCount < 2) {
          expectedState = "InsufficientQuestions";

          const hmrcIvqResponse: HmrcIvqResponse = {
            outcome: "InsufficientQuestions",
          };
          expect(mockAuditServiceSpy).toHaveBeenCalledWith(
            AuditEventType.THIN_FILE_ENCOUNTERED,
            mockInputEvent.sessionItem,
            undefined,
            undefined,
            hmrcIvqResponse
          );
        } else {
          expectedState = "SufficientQuestions";
        }

        const expectedResponse = {
          fetchQuestionsState: `${expectedState}`,
        };

        expect(lambdaResponse).toEqual(expectedResponse);
      }
    );
  });

  describe("Recovery Scenarios", () => {
    it.each(["SavedWithQuestions", "SavedWithNoQuestions"])(
      "should return fetchQuestionsState for a valid nino when a question request is already saved",
      async (scenario: string) => {
        const savedResult = {
          correlationId: "test-correlationId",
          questions: [
            {
              questionKey: "rti-p60-payment-for-year",
              order: 1,
            },
            {
              questionKey: "sa-payment-details",
              order: 2,
            },
            {
              questionKey: "rti-p60-statutory-adoption-pay",
              order: 3,
            },
          ],
        };

        if (scenario == "SavedWithNoQuestions") {
          savedResult.questions = [];
        }

        // No previously saved questions
        saveQuestionsServicegetExistingSavedItemSpy.mockResolvedValue({
          Item: savedResult,
        });

        saveQuestionsServiceSaveQuestionsSpy.mockResolvedValue(true);

        const lambdaResponse = await fetchQuestionsHandler.handler(
          mockInputEvent,
          mockInputContext
        );

        expect(mockMetricsProbeSpy).toHaveBeenCalledWith(
          HandlerMetric.CompletionStatus,
          MetricUnit.Count,
          CompletionStatus.OK
        );

        // Response
        let expectedState: string;
        if (savedResult.questions.length == 0) {
          expectedState = "InsufficientQuestions";
        } else {
          expectedState = "ContinueSufficientQuestionAlreadyRetrieved";
        }

        const expectedResponse = {
          fetchQuestionsState: `${expectedState}`,
        };

        expect(lambdaResponse).toEqual(expectedResponse);
      }
    );
  });

  describe("Failure Scenarios", () => {
    // The following tests test the lambda being called missing requried inputs
    // and checks the assoicated error is thrown
    it.each([
      [undefined, "input event is empty"],
      [
        {
          sessionId: undefined,
        },
        "sessionId was not provided",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
            },
          },
          parameters: undefined,
        },
        "event parameters not found",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
            },
          },
          parameters: {
            url: undefined,
          },
        },
        "questionsUrl was not provided",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
            },
          },
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: undefined,
          },
        },
        "userAgent was not provided",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
            },
          },
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            value: undefined,
          },
        },
        "bearerToken was not provided",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
            },
          },
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            expiry: Date.now() + 7200 * 1000,
            value: "TEST_TOKEN_VALUE",
          },
          personIdentityItem: undefined,
        },
        "personIdentityItem not found",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
            },
          },
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            expiry: Date.now() + 7200 * 1000,
            value: "TEST_TOKEN_VALUE",
          },
          personIdentityItem: {
            nino: undefined,
          },
        },
        "nino was not provided",
      ],
    ])(
      "should return an error event is missing required values",
      async (testInputEvent: any, expectedError: string) => {
        const lambdaResponse = await fetchQuestionsHandler.handler(
          testInputEvent,
          mockInputContext
        );

        expect(mockMetricsProbeSpy).toHaveBeenCalledWith(
          HandlerMetric.CompletionStatus,
          MetricUnit.Count,
          CompletionStatus.ERROR
        );

        const lambdaName = FetchQuestionsHandler.name;
        const errorMessage = `${lambdaName} : ${expectedError}`;
        const expectedResponse = { error: errorMessage };

        expect(lambdaResponse).toEqual(expectedResponse);
      }
    );

    // The following tests test the lambda being called missing requried inputs
    // and checks the assoicated error is thrown
    it.each([
      [
        {
          sessionId: "sessionId",
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            expiry: Date.now() + 7200 * 1000,
            value: "TEST_TOKEN_VALUE",
          },
          personIdentityItem: {
            nino: "TEST_NINO",
          },
        },
        "Session item was not provided",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {},
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            expiry: Date.now() + 7200 * 1000,
            value: "TEST_TOKEN_VALUE",
          },
          personIdentityItem: {
            nino: "TEST_NINO",
          },
        },
        "Session item was malformed : Session item missing Item",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
              clientIpAddress: {
                S: "127.0.0.1",
              },
              redirectUri: {
                S: "http://localhost:8085/callback",
              },
              clientSessionId: {
                S: "2d35a412-125e-423e-835e-ca66111a38a1",
              },
              createdDate: {
                N: "1722954983024",
              },
              clientId: {
                S: "unit-test-clientid",
              },
              subject: {
                S: "urn:fdc:gov.uk:2022:6dab2b2d-5fcb-43a3-b682-9484db4a2ca5",
              },
              persistentSessionId: {
                S: "6c33f1e4-70a9-41f6-a335-7bb036edd3ca",
              },
              attemptCount: {
                N: "0",
              },
              state: {
                S: "7f42f0cc-1681-4455-872f-dd228103a12e",
              },
            },
          },
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            expiry: Date.now() + 7200 * 1000,
            value: "TEST_TOKEN_VALUE",
          },
          personIdentityItem: {
            nino: "TEST_NINO",
          },
        },
        "Session item was malformed : Session item missing sessionId",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              clientIpAddress: {
                S: "127.0.0.1",
              },
              redirectUri: {
                S: "http://localhost:8085/callback",
              },
              clientSessionId: {
                S: "2d35a412-125e-423e-835e-ca66111a38a1",
              },
              createdDate: {
                N: "1722954983024",
              },
              clientId: {
                S: "unit-test-clientid",
              },
              subject: {
                S: "urn:fdc:gov.uk:2022:6dab2b2d-5fcb-43a3-b682-9484db4a2ca5",
              },
              persistentSessionId: {
                S: "6c33f1e4-70a9-41f6-a335-7bb036edd3ca",
              },
              attemptCount: {
                N: "0",
              },
              sessionId: {
                S: "665ed4d5-7576-4c4b-84ff-99af3a57ea64",
              },
              state: {
                S: "7f42f0cc-1681-4455-872f-dd228103a12e",
              },
            },
          },
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            expiry: Date.now() + 7200 * 1000,
            value: "TEST_TOKEN_VALUE",
          },
          personIdentityItem: {
            nino: "TEST_NINO",
          },
        },
        "Session item was malformed : Session item missing expiryDate",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
              redirectUri: {
                S: "http://localhost:8085/callback",
              },
              clientSessionId: {
                S: "2d35a412-125e-423e-835e-ca66111a38a1",
              },
              createdDate: {
                N: "1722954983024",
              },
              clientId: {
                S: "unit-test-clientid",
              },
              subject: {
                S: "urn:fdc:gov.uk:2022:6dab2b2d-5fcb-43a3-b682-9484db4a2ca5",
              },
              persistentSessionId: {
                S: "6c33f1e4-70a9-41f6-a335-7bb036edd3ca",
              },
              attemptCount: {
                N: "0",
              },
              sessionId: {
                S: "665ed4d5-7576-4c4b-84ff-99af3a57ea64",
              },
              state: {
                S: "7f42f0cc-1681-4455-872f-dd228103a12e",
              },
            },
          },
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            expiry: Date.now() + 7200 * 1000,
            value: "TEST_TOKEN_VALUE",
          },
          personIdentityItem: {
            nino: "TEST_NINO",
          },
        },
        "Session item was malformed : Session item missing clientIpAddress",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
              clientIpAddress: {
                S: "127.0.0.1",
              },
              clientSessionId: {
                S: "2d35a412-125e-423e-835e-ca66111a38a1",
              },
              createdDate: {
                N: "1722954983024",
              },
              clientId: {
                S: "unit-test-clientid",
              },
              subject: {
                S: "urn:fdc:gov.uk:2022:6dab2b2d-5fcb-43a3-b682-9484db4a2ca5",
              },
              persistentSessionId: {
                S: "6c33f1e4-70a9-41f6-a335-7bb036edd3ca",
              },
              attemptCount: {
                N: "0",
              },
              sessionId: {
                S: "665ed4d5-7576-4c4b-84ff-99af3a57ea64",
              },
              state: {
                S: "7f42f0cc-1681-4455-872f-dd228103a12e",
              },
            },
          },
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            expiry: Date.now() + 7200 * 1000,
            value: "TEST_TOKEN_VALUE",
          },
          personIdentityItem: {
            nino: "TEST_NINO",
          },
        },
        "Session item was malformed : Session item missing redirectUri",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
              clientIpAddress: {
                S: "127.0.0.1",
              },
              redirectUri: {
                S: "http://localhost:8085/callback",
              },
              createdDate: {
                N: "1722954983024",
              },
              clientId: {
                S: "unit-test-clientid",
              },
              subject: {
                S: "urn:fdc:gov.uk:2022:6dab2b2d-5fcb-43a3-b682-9484db4a2ca5",
              },
              persistentSessionId: {
                S: "6c33f1e4-70a9-41f6-a335-7bb036edd3ca",
              },
              attemptCount: {
                N: "0",
              },
              sessionId: {
                S: "665ed4d5-7576-4c4b-84ff-99af3a57ea64",
              },
              state: {
                S: "7f42f0cc-1681-4455-872f-dd228103a12e",
              },
            },
          },
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            expiry: Date.now() + 7200 * 1000,
            value: "TEST_TOKEN_VALUE",
          },
          personIdentityItem: {
            nino: "TEST_NINO",
          },
        },
        "Session item was malformed : Session item missing clientSessionId",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
              clientIpAddress: {
                S: "127.0.0.1",
              },
              redirectUri: {
                S: "http://localhost:8085/callback",
              },
              clientSessionId: {
                S: "2d35a412-125e-423e-835e-ca66111a38a1",
              },
              clientId: {
                S: "unit-test-clientid",
              },
              subject: {
                S: "urn:fdc:gov.uk:2022:6dab2b2d-5fcb-43a3-b682-9484db4a2ca5",
              },
              persistentSessionId: {
                S: "6c33f1e4-70a9-41f6-a335-7bb036edd3ca",
              },
              attemptCount: {
                N: "0",
              },
              sessionId: {
                S: "665ed4d5-7576-4c4b-84ff-99af3a57ea64",
              },
              state: {
                S: "7f42f0cc-1681-4455-872f-dd228103a12e",
              },
            },
          },
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            expiry: Date.now() + 7200 * 1000,
            value: "TEST_TOKEN_VALUE",
          },
          personIdentityItem: {
            nino: "TEST_NINO",
          },
        },
        "Session item was malformed : Session item missing createdDate",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
              clientIpAddress: {
                S: "127.0.0.1",
              },
              redirectUri: {
                S: "http://localhost:8085/callback",
              },
              clientSessionId: {
                S: "2d35a412-125e-423e-835e-ca66111a38a1",
              },
              createdDate: {
                N: "1722954983024",
              },
              subject: {
                S: "urn:fdc:gov.uk:2022:6dab2b2d-5fcb-43a3-b682-9484db4a2ca5",
              },
              persistentSessionId: {
                S: "6c33f1e4-70a9-41f6-a335-7bb036edd3ca",
              },
              attemptCount: {
                N: "0",
              },
              sessionId: {
                S: "665ed4d5-7576-4c4b-84ff-99af3a57ea64",
              },
              state: {
                S: "7f42f0cc-1681-4455-872f-dd228103a12e",
              },
            },
          },
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            expiry: Date.now() + 7200 * 1000,
            value: "TEST_TOKEN_VALUE",
          },
          personIdentityItem: {
            nino: "TEST_NINO",
          },
        },
        "Session item was malformed : Session item missing clientId",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
              clientIpAddress: {
                S: "127.0.0.1",
              },
              redirectUri: {
                S: "http://localhost:8085/callback",
              },
              clientSessionId: {
                S: "2d35a412-125e-423e-835e-ca66111a38a1",
              },
              createdDate: {
                N: "1722954983024",
              },
              clientId: {
                S: "unit-test-clientid",
              },
              persistentSessionId: {
                S: "6c33f1e4-70a9-41f6-a335-7bb036edd3ca",
              },
              attemptCount: {
                N: "0",
              },
              sessionId: {
                S: "665ed4d5-7576-4c4b-84ff-99af3a57ea64",
              },
              state: {
                S: "7f42f0cc-1681-4455-872f-dd228103a12e",
              },
            },
          },
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            expiry: Date.now() + 7200 * 1000,
            value: "TEST_TOKEN_VALUE",
          },
          personIdentityItem: {
            nino: "TEST_NINO",
          },
        },
        "Session item was malformed : Session item missing subject",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
              clientIpAddress: {
                S: "127.0.0.1",
              },
              redirectUri: {
                S: "http://localhost:8085/callback",
              },
              clientSessionId: {
                S: "2d35a412-125e-423e-835e-ca66111a38a1",
              },
              createdDate: {
                N: "1722954983024",
              },
              clientId: {
                S: "unit-test-clientid",
              },
              subject: {
                S: "urn:fdc:gov.uk:2022:6dab2b2d-5fcb-43a3-b682-9484db4a2ca5",
              },
              attemptCount: {
                N: "0",
              },
              sessionId: {
                S: "665ed4d5-7576-4c4b-84ff-99af3a57ea64",
              },
              state: {
                S: "7f42f0cc-1681-4455-872f-dd228103a12e",
              },
            },
          },
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            expiry: Date.now() + 7200 * 1000,
            value: "TEST_TOKEN_VALUE",
          },
          personIdentityItem: {
            nino: "TEST_NINO",
          },
        },
        "Session item was malformed : Session item missing persistentSessionId",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
              clientIpAddress: {
                S: "127.0.0.1",
              },
              redirectUri: {
                S: "http://localhost:8085/callback",
              },
              clientSessionId: {
                S: "2d35a412-125e-423e-835e-ca66111a38a1",
              },
              createdDate: {
                N: "1722954983024",
              },
              clientId: {
                S: "unit-test-clientid",
              },
              subject: {
                S: "urn:fdc:gov.uk:2022:6dab2b2d-5fcb-43a3-b682-9484db4a2ca5",
              },
              persistentSessionId: {
                S: "6c33f1e4-70a9-41f6-a335-7bb036edd3ca",
              },
              sessionId: {
                S: "665ed4d5-7576-4c4b-84ff-99af3a57ea64",
              },
              state: {
                S: "7f42f0cc-1681-4455-872f-dd228103a12e",
              },
            },
          },
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            expiry: Date.now() + 7200 * 1000,
            value: "TEST_TOKEN_VALUE",
          },
          personIdentityItem: {
            nino: "TEST_NINO",
          },
        },
        "Session item was malformed : Session item missing attemptCount",
      ],
      [
        {
          sessionId: "sessionId",
          sessionItem: {
            Item: {
              expiryDate: {
                N: "1234",
              },
              clientIpAddress: {
                S: "127.0.0.1",
              },
              redirectUri: {
                S: "http://localhost:8085/callback",
              },
              clientSessionId: {
                S: "2d35a412-125e-423e-835e-ca66111a38a1",
              },
              createdDate: {
                N: "1722954983024",
              },
              clientId: {
                S: "unit-test-clientid",
              },
              subject: {
                S: "urn:fdc:gov.uk:2022:6dab2b2d-5fcb-43a3-b682-9484db4a2ca5",
              },
              persistentSessionId: {
                S: "6c33f1e4-70a9-41f6-a335-7bb036edd3ca",
              },
              attemptCount: {
                N: "0",
              },
              sessionId: {
                S: "665ed4d5-7576-4c4b-84ff-99af3a57ea64",
              },
            },
          },
          parameters: {
            url: { value: "TEST_URL" },
            userAgent: { value: "TEST_USER_AGENT" },
          },
          bearerToken: {
            expiry: Date.now() + 7200 * 1000,
            value: "TEST_TOKEN_VALUE",
          },
          personIdentityItem: {
            nino: "TEST_NINO",
          },
        },
        "Session item was malformed : Session item missing state",
      ],
    ])(
      "should return an error sessionItem is missing required values",
      async (testInputEvent: any, expectedError: string) => {
        const lambdaResponse = await fetchQuestionsHandler.handler(
          testInputEvent,
          mockInputContext
        );

        expect(mockMetricsProbeSpy).toHaveBeenCalledWith(
          HandlerMetric.CompletionStatus,
          MetricUnit.Count,
          CompletionStatus.ERROR
        );

        const lambdaName = FetchQuestionsHandler.name;
        const errorMessage = `${lambdaName} : ${expectedError}`;
        const expectedResponse = { error: errorMessage };

        expect(lambdaResponse).toEqual(expectedResponse);
      }
    );

    it("should return an error if there is an issue during question retrieval ", async () => {
      // No previously saved questions
      saveQuestionsServicegetExistingSavedItemSpy.mockResolvedValue(undefined);

      questionsRetrievalServiceSpy.mockImplementation(() => {
        const testErrorMessage: string = "An error occured";
        throw new Error(testErrorMessage);
      });

      const lambdaResponse = await fetchQuestionsHandler.handler(
        mockInputEvent,
        mockInputContext
      );

      const mockFetchQuestionInputs = {
        sessionId: mockInputEvent.sessionId,
        sessionTtl: Number(mockInputEvent.sessionItem.Item.expiryDate.N),
        questionsUrl: mockInputEvent.parameters.url.value,
        userAgent: mockInputEvent.parameters.userAgent.value,
        bearerToken: mockInputEvent.bearerToken.value,
        nino: mockInputEvent.personIdentityItem.nino,
        sessionItem: mockInputEvent.sessionItem,
      } as FetchQuestionInputs;

      expect(questionsRetrievalServiceSpy).toHaveBeenCalledWith(
        mockFetchQuestionInputs
      );

      expect(mockMetricsProbeSpy).toHaveBeenCalledWith(
        HandlerMetric.CompletionStatus,
        MetricUnit.Count,
        CompletionStatus.ERROR
      );

      const lambdaName = FetchQuestionsHandler.name;
      const errorText: string = "An error occured";
      const errorMessage = `${lambdaName} : ${errorText}`;
      const expectedResponse = { error: errorMessage };

      expect(lambdaResponse).toEqual(expectedResponse);
    });

    it("should return an error if there is an issue during question save ", async () => {
      const correlationId: string = "test-correlsation-id";

      const mockQuestionsRetrievalServiceResponse = new QuestionsResult(
        correlationId,
        [
          new Question("rti-p60-payment-for-year", undefined, undefined),
          new Question("sa-payment-details", "2021/2022", "2020/2021"),
          new Question("rti-p60-statutory-adoption-pay", undefined, undefined),
        ]
      );

      questionsRetrievalServiceSpy.mockResolvedValue(
        mockQuestionsRetrievalServiceResponse
      );

      // No previously saved questions
      saveQuestionsServicegetExistingSavedItemSpy.mockResolvedValue(undefined);

      saveQuestionsServiceSaveQuestionsSpy.mockImplementation(() => {
        const testErrorMessage: string = "An error occured";
        throw new Error(testErrorMessage);
      });

      const lambdaResponse = await fetchQuestionsHandler.handler(
        mockInputEvent,
        mockInputContext
      );

      const mockFetchQuestionInputs = {
        sessionId: mockInputEvent.sessionId,
        sessionTtl: Number(mockInputEvent.sessionItem.Item.expiryDate.N),
        questionsUrl: mockInputEvent.parameters.url.value,
        userAgent: mockInputEvent.parameters.userAgent.value,
        bearerToken: mockInputEvent.bearerToken.value,
        nino: mockInputEvent.personIdentityItem.nino,
        sessionItem: mockInputEvent.sessionItem,
      } as FetchQuestionInputs;

      expect(questionsRetrievalServiceSpy).toHaveBeenCalledWith(
        mockFetchQuestionInputs
      );
      expect(saveQuestionsServiceSaveQuestionsSpy).toHaveBeenCalledWith(
        mockInputEvent.sessionId,
        Number(mockInputEvent.sessionItem.Item.expiryDate.N),
        correlationId,
        mockQuestionsRetrievalServiceResponse.questions
      );

      expect(mockMetricsProbeSpy).toHaveBeenCalledWith(
        HandlerMetric.CompletionStatus,
        MetricUnit.Count,
        CompletionStatus.ERROR
      );

      const lambdaName = FetchQuestionsHandler.name;
      const errorText: string = "An error occured";
      const errorMessage = `${lambdaName} : ${errorText}`;
      const expectedResponse = { error: errorMessage };

      expect(lambdaResponse).toEqual(expectedResponse);
    });
  });
});
