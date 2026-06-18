const PAYMENT_NETWORKS = ['trc20', 'erc20', 'bep20'];

const NETWORK_LABELS = {
  trc20: 'TRC20 (Tron USDT)',
  erc20: 'ERC20 (Ethereum USDT)',
  bep20: 'BEP20 (BSC USDT)',
};

const TRC20_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_REGEX = /^0x[a-fA-F0-9]{40}$/;

function normalizePaymentAddresses(input = {}) {
  return {
    trc20: String(input.trc20 || '').trim(),
    erc20: String(input.erc20 || '').trim(),
    bep20: String(input.bep20 || '').trim(),
  };
}

function validatePaymentAddress(network, address) {
  const value = String(address || '').trim();
  if (!value) return null;

  if (network === 'trc20') {
    if (!TRC20_REGEX.test(value)) {
      return 'TRC20 address must be 34 characters and start with T';
    }
    return null;
  }

  if (network === 'erc20' || network === 'bep20') {
    if (!EVM_REGEX.test(value)) {
      return `${network.toUpperCase()} address must start with 0x followed by 40 hex characters`;
    }
    return null;
  }

  return 'Unknown payment network';
}

function validatePaymentAddresses(input = {}) {
  const normalized = normalizePaymentAddresses(input);
  const errors = {};

  for (const network of PAYMENT_NETWORKS) {
    const error = validatePaymentAddress(network, normalized[network]);
    if (error) errors[network] = error;
  }

  return { normalized, errors };
}

function summarizePaymentAddresses(addresses = {}) {
  const normalized = normalizePaymentAddresses(addresses);
  const networks = PAYMENT_NETWORKS.filter((network) => normalized[network]);
  return {
    ...normalized,
    hasAny: networks.length > 0,
    networks,
    networksLabel: networks.length
      ? networks.map((network) => network.toUpperCase()).join(', ')
      : 'None set',
  };
}

module.exports = {
  PAYMENT_NETWORKS,
  NETWORK_LABELS,
  normalizePaymentAddresses,
  validatePaymentAddress,
  validatePaymentAddresses,
  summarizePaymentAddresses,
};
