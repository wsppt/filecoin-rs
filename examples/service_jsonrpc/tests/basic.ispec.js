/* eslint-disable no-console */
import { test, expect } from "jest";
import * as bip32 from "bip32";
import * as bip39 from "bip39";
import secp256k1 from "secp256k1";
import fs from "fs";
import { getDigest } from "./utils.js";
import { callMethod } from "../src";

const tests_vectors_path = "../manual_testvectors.json";

// WARNING: filecoin-service is expected to be running
const URL = "http://127.0.0.1:3030/v0";
const EXPECTED_MNEMONIC = "equip will roof matter pink blind book anxiety banner elbow sun young";
const EXPECTED_SEED = "xprv9s21ZrQH143K49QgrAgAVELf6ue2tZNHYUc7yfj8JGZY9SpZ38u8EfhWi85GsA6grUeB36wXrbNTkjX9EfGP1ybbPRG4sdP2EPfY1SZ2BF5";
const EXPECTED_ROOT_NODE = bip32.fromBase58(EXPECTED_SEED);

const EXAMPLE_TRANSACTION_CBOR =
  "89005501fd1d0f4dfcd7e99afcb99a8326b7dc459d32c62855010f323f4709e8e4db0c1d4cd374f9f35201d26fb20144000186a0430009c41961a80040";

const EXAMPLE_TRANSACTION = {
  to: "t17uoq6tp427uzv7fztkbsnn64iwotfrristwpryy",
  from: "t1b4zd6ryj5dsnwda5jtjxj6ptkia5e35s52ox7ka",
  nonce: 1,
  value: "100000",
  gasprice: "2500",
  gaslimit: 25000,
  method: 0,
  params: "",
};

test("key_generate_mnemonic", async () => {
  const response = await callMethod(URL, "key_generate_mnemonic", [], 1);
  console.log(response);

  // Do we have a results
  expect(response).toHaveProperty("result");
  // Verify we have 24 words
  expect(response.result.split(" ").length).toBe(24);
});

test("key_derive", async () => {
  const path = "m/44'/461'/0/0/0";
  const response = await callMethod(URL, "key_derive", [EXPECTED_MNEMONIC, path, ""], 1);
  const child = EXPECTED_ROOT_NODE.derivePath(path);
  console.log(response);

  // Do we have a results
  expect(response).toHaveProperty("result");
  expect(response.result.private_hexstring).toEqual(child.privateKey.toString("hex"));
  expect(response.result.public_compressed_hexstring).toEqual(child.publicKey.toString("hex"));
  expect(response.result.address).toEqual("f1d2xrzcslx7xlbbylc5c3d5lvandqw4iwl6epxba");
});

test("key_derive testnet path", async () => {
  const path = "m/44'/1'/0/0/0";
  const response = await callMethod(URL, "key_derive", [EXPECTED_MNEMONIC, path, ""], 1);
  const child = EXPECTED_ROOT_NODE.derivePath(path);
  console.log(response);

  // Do we have a results
  expect(response).toHaveProperty("result");
  expect(response.result.private_hexstring).toEqual(child.privateKey.toString("hex"));
  expect(response.result.public_compressed_hexstring).toEqual(child.publicKey.toString("hex"));
  expect(response.result.address.startsWith('t')).toBeTruthy();
});

test("key_derive missing all parameters", async () => {
  const response = await callMethod(URL, "key_derive", [], 1);
  console.log(response);

  expect(response).toHaveProperty("error");
  expect(response.error.message).toMatch(/Invalid params/);
});

test("key_derive missing path parameters", async () => {
  const response = await callMethod(URL, "key_derive", [EXPECTED_MNEMONIC], 1);
  console.log(response);

  expect(response).toHaveProperty("error");
  expect(response.error.message).toMatch(/Invalid params/);
});

test("key_derive invalid path parameter", async () => {
  const response = await callMethod(URL, "key_derive", [EXPECTED_MNEMONIC, ""], 1);
  console.log(response);

  expect(response).toHaveProperty("error");
  expect(response.error.message).toMatch(/Path should start with `m`/);
});

test("key_derive missing password parameter (verify default)", async () => {
  const path = "m/44'/461'/0/0/0";
  const response = await callMethod(URL, "key_derive", [EXPECTED_MNEMONIC, path], 1);
  const child = EXPECTED_ROOT_NODE.derivePath(path);
  console.log(response);

  expect(response).toHaveProperty("result");
  expect(response.result.private_hexstring).toEqual(child.privateKey.toString("hex"));
  expect(response.result.public_compressed_hexstring).toEqual(child.publicKey.toString("hex"));
  expect(response.result.address).toEqual("f1d2xrzcslx7xlbbylc5c3d5lvandqw4iwl6epxba");
});

test("key_derive_from_seed", async () => {
  const path = "m/44'/461'/0/0/0";
  const seed = bip39.mnemonicToSeedSync(EXPECTED_MNEMONIC).toString('hex');

  const response = await callMethod(URL, "key_derive_from_seed", [seed, path], 1);
  const child = EXPECTED_ROOT_NODE.derivePath(path);
  console.log(response);

  // Do we have a results
  expect(response).toHaveProperty("result");
  expect(response.result.private_hexstring).toEqual(child.privateKey.toString("hex"));
  expect(response.result.public_compressed_hexstring).toEqual(child.publicKey.toString("hex"));
  expect(response.result.address).toEqual("f1d2xrzcslx7xlbbylc5c3d5lvandqw4iwl6epxba");
});

test("transaction_serialize", async () => {
  const response = await callMethod(URL, "transaction_serialize", EXAMPLE_TRANSACTION, 1);

  expect(Buffer.from(response.result).toString("hex")).toBe(EXAMPLE_TRANSACTION_CBOR);
});

test("transaction_parse", async () => {
  const response = await callMethod(URL, "transaction_parse", [EXAMPLE_TRANSACTION_CBOR, true], 1);

  expect(response.result).toBe(JSON.stringify(EXAMPLE_TRANSACTION));
});

test("transaction_parse_invalid_length", async () => {
  const response = await callMethod(URL, "transaction_parse", [EXAMPLE_TRANSACTION_CBOR+"'", true], 1);

  expect(response).toHaveProperty("error");
  expect(response.error.message).toMatch(/Hex decoding | Invalid length/);
});

test("transaction_testvectors", async () => {
  const rawData = fs.readFileSync(tests_vectors_path);
  const jsonData = JSON.parse(rawData);

  for (let i = 0; i < jsonData.length; i += 1) {
    const tc = jsonData[i];
    console.log(tc.message);
    if (!tc.message.params) {
      tc.message.params = "";
    }

    const response = await callMethod(URL, "transaction_serialize", tc.message, i);

    if (response.error) {
      console.log("Error", response);
      expect(tc.valid).toEqual(false);
    } else {
      console.log(
        "Testcase ------------------------------------------------------------------------------------",
      );
      console.log(tc.description);
      console.log("Reply", response);
      expect(Buffer.from(response.result).toString("hex")).toEqual(tc.encoded_tx_hex);
    }
  }
});

const rawData = fs.readFileSync(tests_vectors_path);
const jsonData = JSON.parse(rawData);

for (let i = 0; i < jsonData.length; i += 1) {
  const tc = jsonData[i];
  if (!tc.message.params) {
    tc.message.params = "";
  }

  if (tc.not_implemented) {
    // FIXME: Protocol 0 parsing not implemented in forest
    // FIXME: doesn't fail for empty value #54
    console.log("FIX ME: Protocol 0 parsing not implemented in forest");
    continue;
  }
  // Create test case for each
  test(`Parse Transaction : ${tc.description}`, async () => {
    const response = await callMethod(URL, "transaction_parse", [tc.encoded_tx_hex, tc.testnet], i);

    if (tc.valid) {
      console.log(response);
      expect(JSON.parse(response.result)).toEqual(tc.message);
    } else {
      console.log(response.error);
      expect(response).toHaveProperty("error");
    }
  });
}

test("sign_transaction", async () => {
  const child = EXPECTED_ROOT_NODE.derivePath("m/44'/461'/0/0/0");
  const message_digest = getDigest(Buffer.from(EXAMPLE_TRANSACTION_CBOR, "hex"));

  const response = await callMethod(
    URL,
    "sign_transaction",
    [EXAMPLE_TRANSACTION, child.privateKey.toString("hex")],
    1,
  );

  console.log(response);

  const signatureBuffer = Buffer.from(response.result.signature.data, "base64").slice(0, -1);

  // compare signature
  const signatureCompare = secp256k1.ecdsaSign(message_digest, child.privateKey);

  expect(Buffer.from(signatureCompare.signature)).toEqual(signatureBuffer);

  // Remove V from result to verify signature
  const result = secp256k1.ecdsaVerify(signatureBuffer, message_digest, child.publicKey);

  expect(result).toBeTruthy();
});

test("sign_invalid_transaction", async () => {
  const child = EXPECTED_ROOT_NODE.derivePath("m/44'/461'/0/0/0");
  const invalid_transaction = {
    to: "t17uoq6tp427uzv7fztkbsnn64iwotfrristwpryy",
    from: "t1xcbgdhkgkwht3hrrnui3jdopeejsoas2rujnkdi",
    value: "100000",
    gasprice: "2500",
    gaslimit: 25000,
    method: 0,
    params: "",
  };

  const response = await callMethod(
    URL,
    "sign_transaction",
    [invalid_transaction, child.privateKey.toString("hex")],
    1,
  );

  // Verify we have an error message
  expect(response).toHaveProperty("error");
  // Verify we have the corrcet error message 'missing nonce'
  expect(response.error.message).toMatch(/missing field `nonce`/);
});

test("verify_signature", async () => {
  const child = EXPECTED_ROOT_NODE.derivePath("m/44'/461'/0/0/0");

  const message_digest = getDigest(Buffer.from(EXAMPLE_TRANSACTION_CBOR, "hex"));

  const signature = secp256k1.ecdsaSign(message_digest, child.privateKey);

  // Concat v value at the end of the signature
  const signatureRSV =
    Buffer.from(signature.signature).toString("hex") + Buffer.from([signature.recid]).toString("hex");

  const response = await callMethod(URL, "verify_signature", [signatureRSV, EXAMPLE_TRANSACTION_CBOR], 1);

  console.log(response);

  expect(response.result).toEqual(true);
});

test("verify_invalid_signature", async () => {
  const child = EXPECTED_ROOT_NODE.derivePath("m/44'/461'/0/0/0");

  const message_digest = getDigest(Buffer.from(EXAMPLE_TRANSACTION_CBOR, "hex"));

  const signature = secp256k1.ecdsaSign(message_digest, child.privateKey);

  // Tampered signature
  const invalid_signature = Buffer.concat([Buffer.from(signature.signature).slice(0, 36), Buffer.alloc(28)]);

  // Concat recovery id value at the end of the signature
  const signatureRSV = invalid_signature.toString("hex") + Buffer.from([signature.recid]).toString("hex");

  const response = await callMethod(URL, "verify_signature", [signatureRSV, EXAMPLE_TRANSACTION_CBOR], 1);

  console.log(response);

  const result = secp256k1.ecdsaVerify(invalid_signature, message_digest, child.publicKey);

  expect(result).toEqual(false);
  expect(response.result).toEqual(false);
});

test("get_status", async () => {
  let message_cid = "bafy2bzacea2ob4bctlucgp2okbczqvk5ctx4jqjapslz57mbcmnnzyftgeqgu";
  const response = await callMethod(URL, "get_status", [message_cid], 1);
  console.log(response);

  // Do we have a results
  expect(response).toHaveProperty("result");
  expect(response.result).toEqual({
        "From": "t3wjxuftije2evjmzo2yoy5ghfe2o42mavrpmwuzooghzcxdhqjdu7kn6dvkzf4ko37w7sfnnzdzstcjmeooea",
        "GasLimit": "1000",
        "GasPrice": "0",
        "Method": 0,
        "Nonce": 66867,
        "Params": "",
        "To": "t1lv32q33y64xs64pnyn6om7ftirax5ikspkumwsa",
        "Value": "5000000000000000"
    });
});

test("get_status fail", async () => {
  const message_cid = "bafy2bzaceaxm23epjsmh75yvzcecsrbavlmkcxnva66bkdebdcnyw3bjrc74u";
  const response = await callMethod(URL, "get_status", [message_cid], 1);
  console.log(response);

  // Do we have a results
  expect(response).toHaveProperty("error");
});

test("get_nonce", async () => {
  const account = "t1lv32q33y64xs64pnyn6om7ftirax5ikspkumwsa";

  const response = await callMethod(
    URL,
    "get_nonce",
    [account],
    1,
  );

  console.log(response);

  expect(response.result).toBeGreaterThanOrEqual(2);
});

test.skip("send_signed_tx", async () => {
  const path = "m/44'/1'/0/0/0";
  const keyAddressResponse = await callMethod(URL, "key_derive", [EXPECTED_MNEMONIC, path], 1);

  console.log(keyAddressResponse);

  // Get Nonce
  const nonceResponse = await callMethod(URL, "get_nonce", [keyAddressResponse.result.address], 1);

  console.log("-----------------------------------------------------------------------------------");
  let nonce = nonceResponse.result;
  nonce++;
  console.log("Nonce: ", nonce);

  expect(!isNaN(nonce));

  const transaction = {
    to: "t17uoq6tp427uzv7fztkbsnn64iwotfrristwpryy",
    from: keyAddressResponse.result.address,
    nonce: nonce,
    value: "1",
    gasprice: "0",
    gaslimit: 1000000,
    method: 0,
    params: "",
  };

  console.log("-----------------------------------------------------------------------------------");

  const signedTxResponse = await callMethod(
    URL,
    "sign_transaction",
    [transaction, keyAddressResponse.result.private_hexstring],
    2,
  );

  console.log("SignedTx: ", signedTxResponse);

  let signature_hex = Buffer.from(signedTxResponse.result.signature.data, 'base64').toString('hex');
  console.log("Signature_hex: ", signature_hex);
  console.log("Signature_hex_len: ", signature_hex.length);
  expect(signature_hex.length).toBe(130);

  console.log("-----------------------------------------------------------------------------------");

  const response = await callMethod(URL, "send_signed_tx", [signedTxResponse.result], 1);

  console.log(response);

  expect(response).toHaveProperty("result");
});

test.skip("send_sign", async () => {
  const path = "m/44'/1'/0/0/0";
  const keyAddressResponse = await callMethod(URL, "key_derive", [EXPECTED_MNEMONIC, path], 1);

  console.log(keyAddressResponse);

  // Get Nonce
  const nonceResponse = await callMethod(URL, "get_nonce", [keyAddressResponse.result.address], 1);

  console.log("-----------------------------------------------------------------------------------");
  let nonce = nonceResponse.result;
  nonce++;
  console.log("Nonce: ", nonce);

  const transaction = {
    to: "t17uoq6tp427uzv7fztkbsnn64iwotfrristwpryy",
    from: keyAddressResponse.result.address,
    nonce: nonce,
    value: "1",
    gasprice: "0",
    gaslimit: 1000000,
    method: 0,
    params: "",
  };

  console.log("-----------------------------------------------------------------------------------");

  const response = await callMethod(
    URL,
    "send_sign",
    [transaction, keyAddressResponse.result.private_hexstring],
    2,
  );

  console.log("cidHash: ", response);

  expect(response).toHaveProperty("result");
});

test("send_sign wrong network", async () => {
  const path = "m/44'/461'/0/0/0";
  const keyAddressResponse = await callMethod(URL, "key_derive", [EXPECTED_MNEMONIC, path], 1);

  console.log(keyAddressResponse);

  // Get Nonce
  const nonceResponse = await callMethod(URL, "get_nonce", [keyAddressResponse.result.address], 1);

  console.log("-----------------------------------------------------------------------------------");
  let nonce = nonceResponse.result;
  nonce++;
  console.log("Nonce: ", nonce);

  const transaction = {
    to: "f17uoq6tp427uzv7fztkbsnn64iwotfrristwpryy",
    from: keyAddressResponse.result.address,
    nonce: nonce,
    value: "1",
    gasprice: "0",
    gaslimit: "1000000",
    method: 0,
    params: "",
  };

  console.log("-----------------------------------------------------------------------------------");

  const response = await callMethod(
    URL,
    "send_sign",
    [transaction, keyAddressResponse.result.private_hexstring],
    2,
  );

  console.log("error: ", response);

  expect(response).toHaveProperty("error");
});
