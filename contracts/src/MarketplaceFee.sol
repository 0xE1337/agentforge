// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title MarketplaceFee — On-chain revenue split accounting for the Skill Marketplace
/// @notice Tracks how each x402 nanopayment splits between skill owners and the
///         platform treasury. Pure accounting — actual USDC settlement happens
///         via Circle Gateway, this contract provides the transparent ledger.
///
/// Revenue model:
///   - Skill owner receives (100% - platformFeeBps) of each payment
///   - Platform treasury receives platformFeeBps of each payment
///   - All splits are recorded on-chain for full transparency
///   - Anyone can verify the revenue distribution via view functions
contract MarketplaceFee {
    // -----------------------------------------------------------------
    //  Storage
    // -----------------------------------------------------------------

    address public immutable governor;

    /// @dev Platform fee in basis points (500 = 5%)
    uint256 public platformFeeBps;

    /// @dev skillId => total revenue recorded (USDC, 6 decimals)
    mapping(uint256 => uint256) public skillRevenue;

    /// @dev skillId => owner earnings after platform fee
    mapping(uint256 => uint256) public ownerEarnings;

    /// @dev Total platform treasury earnings
    uint256 public platformEarnings;

    /// @dev Total payments recorded
    uint256 public totalPayments;

    /// @dev Total volume (USDC)
    uint256 public totalVolume;

    // -----------------------------------------------------------------
    //  Events
    // -----------------------------------------------------------------

    event PaymentRecorded(
        uint256 indexed skillId,
        address indexed payer,
        uint256 totalAmount,
        uint256 ownerShare,
        uint256 platformShare
    );

    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    // -----------------------------------------------------------------
    //  Errors
    // -----------------------------------------------------------------

    error NotGovernor();
    error FeeTooHigh(); // Max 20% = 2000 bps

    // -----------------------------------------------------------------
    //  Constructor
    // -----------------------------------------------------------------

    /// @param _governor Governor address (can update fees)
    /// @param _feeBps Initial platform fee in basis points (e.g., 500 = 5%)
    constructor(address _governor, uint256 _feeBps) {
        if (_feeBps > 2000) revert FeeTooHigh();
        governor = _governor;
        platformFeeBps = _feeBps;
    }

    // -----------------------------------------------------------------
    //  Core — Record Payment
    // -----------------------------------------------------------------

    /// @notice Record a skill payment and compute the revenue split.
    ///         Called by the orchestrator or payment middleware after each x402 settlement.
    /// @param skillId The skill that was paid for
    /// @param payer The agent that paid
    /// @param amount Total USDC amount (6 decimals)
    function recordPayment(
        uint256 skillId,
        address payer,
        uint256 amount
    ) external {
        uint256 platformShare = (amount * platformFeeBps) / 10_000;
        uint256 ownerShare = amount - platformShare;

        skillRevenue[skillId] += amount;
        ownerEarnings[skillId] += ownerShare;
        platformEarnings += platformShare;
        totalPayments += 1;
        totalVolume += amount;

        emit PaymentRecorded(skillId, payer, amount, ownerShare, platformShare);
    }

    // -----------------------------------------------------------------
    //  Views
    // -----------------------------------------------------------------

    /// @notice Get the revenue split for a given amount (preview)
    function previewSplit(uint256 amount) external view returns (
        uint256 ownerShare,
        uint256 platformShare
    ) {
        platformShare = (amount * platformFeeBps) / 10_000;
        ownerShare = amount - platformShare;
    }

    /// @notice Get marketplace summary stats
    function getStats() external view returns (
        uint256 _totalPayments,
        uint256 _totalVolume,
        uint256 _platformEarnings,
        uint256 _platformFeeBps
    ) {
        return (totalPayments, totalVolume, platformEarnings, platformFeeBps);
    }

    // -----------------------------------------------------------------
    //  Admin
    // -----------------------------------------------------------------

    /// @notice Update platform fee (governor only, max 20%)
    function setFee(uint256 newFeeBps) external {
        if (msg.sender != governor) revert NotGovernor();
        if (newFeeBps > 2000) revert FeeTooHigh();
        emit FeeUpdated(platformFeeBps, newFeeBps);
        platformFeeBps = newFeeBps;
    }
}
