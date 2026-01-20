const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function isValidEvmAddress(address: string): boolean {
	return EVM_ADDRESS_REGEX.test(address);
}
