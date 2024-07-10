import { defineFeature, loadFeature } from "jest-cucumber";
import request from "supertest";
import EndPoints from "../../../apiEndpoints/endpoints";
import { generateClaimsUrl, postUpdatedClaimsUrl, postRequestToSessionEndpoint } from '../../../utils/create-session';


const feature = loadFeature(
  "./tests/resources/features/createSession/createSessionRequest-sessionId-HappyPath.feature"
);

defineFeature(feature, (test) => {
  let getClaimsUrl: any;
  let postSessionRequest: any;
  let generateValidClaimUrl: any;
  let postValidClaimUrl: any;

  beforeEach(async () => {
    // await timeDelayForTestEnvironment(3500);
  });

  test("Happy Path - Request for user claimSet from CoreStub for Valid User", ({
    given,
    when,
    then,
  }) => {
    given(
      /^I send a GET request to the CoreStub for a Valid UserId$/,
      async () => {
        generateValidClaimUrl = await generateClaimsUrl();
        postValidClaimUrl = await postUpdatedClaimsUrl();
        postSessionRequest = await postRequestToSessionEndpoint();
        }

    );

    then(
      /^I should receive a response with statusCode and user claimSet$/,
      async () => {
        // console.log(
        //   "POST Response Status Code = " + getClaimsUrl.statusCode
        // );
        // console.log(
        //   " POST Response Body = " +
        //     JSON.stringify(getClaimsUrl.body, undefined, 2)
        // );
        // expect(getClaimsUrl.statusCode).toEqual(Number(statusCode));
      }
    );
  });
});
