let coins = require('coins')
let {
  ed25519Account,
  secp256k1Account,
  multisigAccount
} = coins

module.exports = function staking (opts = {}) {
  let unbondingPeriod = opts.unbondingPeriod || 30 * 24 * 60 * 60

  // create accounts handler to use recursively for bonded accounts
  let handlers = Object.assign({
    ed25519: ed25519Account,
    secp256k1: secp256k1Account,
    multisig: multisigAccount
  }, opts.handlers)
  let accounts = coins.accounts(handlers)

  return {
    initialState: {
      bonded: {},
      unbonding: []
    },

    onInput (input, state, context) {
      // withdraw from bonded account (must pay into unbond queue)
      // get substate for this validator
      let validatorPubkey = input.validatorPubkey.toLowerCase()
      let validator = state.bonded[validatorPubkey]
      if (validator == null) {
        throw Error(`No staking state for validator "${validatorPubkey}"`)
      }

      // calculate number of shares (input is denominated in coins)
      // TODO: check that numbers don't go above Number.MAX_SAFE_INTEGER
      let sharesPerCoin = Math.floor(1e8 * validator.shares / validator.balance)
      let shares = Math.floor(input.amount * sharesPerCoin / 1e8)

      // ensure user has right to withdraw,
      // if so then deduct share balance and increase sequence
      // TODO: find a cleaner API for programmatically debiting accounts
      let modifiedInput = Object.assign({}, input, { amount: shares })
      accounts.onInput(modifiedInput, validator.accounts, context)

      // remove voting power from validator
      context.validators[validatorPubkey] -= input.amount

      // ensure tx pays into unbond queue
      context.transaction.mustHaveOutput({
        type: input.type,
        amount: input.amount,
        address: input.address,
        validatorPubkey,
        unbond: true
      })
    },

    // bond, or put into unbond queue
    onOutput (output, tx, state, context) {
      // add to unbonding queue, to be processed once period is over
      if (output.unbond) {
        // get substate for this validator
        let validatorPubkey = output.validatorPubkey.toLowerCase()
        let validator = state.bonded[validatorPubkey]
        if (validator == null) {
          throw Error(`No staking state for validator "${validatorPubkey}"`)
        }

        // calculate number of shares
        let sharesPerCoin = Math.floor(1e8 * validator.shares / validator.balance)
        let shares = Math.floor(output.amount * sharesPerCoin / 1e8)

        let modifiedOutput = Object.assign({}, output, {
          time: context.time + unbondingPeriod,
          shares
        })
        delete modifiedOutput.amount
        state.unbonding.push(modifiedOutput)
        return
      }

      // bonding
      if (output.bond) {
        let validatorPubkey = output.validatorPubkey.toLowerCase()
        let validator = state.bonded[validatorPubkey]
        if (validator == null) {
          validator = {
            balance: 0,
            shares: 0,
            accounts: {}
          }
          state.bonded[validatorPubkey] = validator
        }

        // add coins and shares to total
        // TODO: check that numbers don't go above Number.MAX_SAFE_INTEGER
        let sharesPerCoin = Math.floor(1e8 * validator.shares / validator.balance)
        if (validator.balance === 0) sharesPerCoin = 1e8
        let shares = Math.floor(output.amount * sharesPerCoin / 1e8)
        validator.balance += output.amount
        validator.shares += shares

        // add voting power to validator
        let votingPower = context.validators[validatorPubkey] || 0
        context.validators[validatorPubkey] = votingPower + output.amount

        // add coins to bonded account balance
        // TODO: find a cleaner API for programmatically adding to accounts
        let modifiedOutput = Object.assign({}, output, { amount: shares })
        accounts.onOutput(modifiedOutput, validator.accounts, context)

        return
      }

      throw Error('Must bond or pay to unbond queue')
    },

    onBlock ({ bonded, unbonding }, context) {
      // process unbond queue
      while (unbonding[0] != null && unbonding[0].time <= context.time) {
        let output = unbonding.shift()

        // get substate for this validator
        let validatorPubkey = output.validatorPubkey
        let validator = bonded[validatorPubkey]
        if (validator == null) {
          throw Error(`No staking state for validator "${validatorPubkey}"`)
        }

        // remove shares/coins from validator pool
        let coinsPerShare = Math.floor(1e8 * validator.balance / validator.shares)
        if (validator.balance === 0) coinsPerShare = 1e8
        let coins = Math.floor(output.shares * coinsPerShare / 1e8)
        validator.shares -= output.shares
        validator.balance -= coins

        let modifiedOutput = Object.assign({}, output)
        modifiedOutput.amount = coins
        delete modifiedOutput.shares
        // TODO: find a cleaner API for programmatically adding to accounts
        context.mint(modifiedOutput)
      }
    }
  }
}
