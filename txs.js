
// // bond
// {
//   from: {
//     type: 'account',
//     amount: 105,
//     pubkey: 'myAccountPubkey',
//     signature: 'sfkjslfjlskfjalskdfjlskfdj',
//     nonce: 123
//   },
//   to: [
//     {
//       type: 'stake',
//       amount: 100,
//       pubkey: 'somevalidator',
//       address: 'myBondAccountAddress'
//     },
//     {
//       type: 'fee',
//       amount: 5
//     }
//   ]
// }
//
// // unbond
// {
//   from: [
//     {
//       type: 'account',
//       amount: 5,
//       pubkey: 'myAccountPubkey',
//       signature: 'sfkjslfjlskfjalskdfjlskfdj',
//       nonce: 124
//     },
//     {
//       type: 'stake',
//       amount: 100,
//       address: 'myBondAccountAddress',
//       signature: 'sfkjslfjlskfjalskdfjlskfdj',
//       nonce: 0
//     }
//   ],
//   to: [
//     {
//       type: 'stake',
//       unbond: true,
//       amount: 100,
//       address: 'myBondAccountAddress'
//     },
//     {
//       type: 'fee',
//       amount: 5
//     }
//   ]
// }
