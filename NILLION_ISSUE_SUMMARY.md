# Nillion Data Push Issue - Need Help from Team

**Date**: November 4, 2025  
**Status**: ❌ BLOCKED - API Format Error

---

## ✅ What We Fixed

1. **Added `useClusterKey: true`** to ALL client configurations (BuilderClient + UserClient)
2. **Updated all URLs** to use proper `urls: { chain, auth, dbs }` format
3. **Cleared old nillion_login records** (37 old keys deleted)
4. **All 3 nodes are responding** (not a connectivity issue)

---

## ❌ Current Error

```
Invalid string: must match pattern /^did:nil:([a-zA-Z0-9]{66})$/
Path: ["data", "_id"]
```

**All 3 nodes reject the data** with the same error.

---

## 🔍 What's Happening

1. We create a collection with schema (no `_id` field defined)
2. We call `userClient.createData()` with data (no `_id` in our data)
3. **SDK automatically adds `_id` field** to the data
4. Nillion nodes **reject it** because `_id` format is wrong

---

## 📋 Questions for Nillion Team (Javi)

### 1. **Has the `_id` format requirement changed?**
   - Previous migrations worked with UUID format
   - Now nodes require DID format: `did:nil:[66 chars]`
   - Is this a recent API change?

### 2. **Should we include `_id` in our schema?**
   - Current schema has NO `_id` field
   - SDK seems to auto-add it
   - Should we explicitly define it in schema?

### 3. **What's the correct `_id` value?**
   Options we've tried:
   - ❌ `randomUUID()` - rejected
   - ❌ `userClient.keypair.toDid().toString()` - rejected  
   - ❌ Not including `_id` at all - SDK adds it, still rejected

### 4. **SDK Version Issue?**
   Current versions:
   ```
   @nillion/secretvaults@0.1.5
   @nillion/nuc@0.1.1
   @nillion/blindfold@0.1.0
   ```
   Should we update to latest versions?

---

## 🧪 Test Collections Created

You can check these on the explorer (they were created successfully, just can't add data):

- `ab61eab9-b3c2-469c-863f-2a09ac70d955`
- `338d7667-4b55-4f8b-9c93-57817c9a7a92` 
- `98c9daac-c317-49d8-84eb-2a65c4ca24f2`

---

## 📝 Code Snippets

### Collection Creation (✅ Works)
```typescript
const collection = {
  _id: collectionId,
  type: "owned",
  name: "Puffpaw Schema",
  schema,  // No _id field in schema
};
await builderClient.createCollection(collection);
```

### Data Creation (❌ Fails)
```typescript
const userOwnedData = {
  ...data,  // Our puff data, no _id field
};

await userClient.createData(delegation, {
  owner: userClient.keypair.toDid().toString(),
  acl: { grantee: builderDid, read: true, write: false, execute: true },
  collection: collectionId,
  data: [userOwnedData],  // SDK adds _id here, gets rejected
});
```

---

## 🎯 What We Need

**One of these solutions:**

1. Correct `_id` format/generation method
2. Updated SDK versions if this is fixed
3. Schema example that works with current API
4. Confirmation if collections still work the same way

---

**Ready to push data once we know the correct format!** 🚀  
All `useClusterKey: true` fixes are in place.

