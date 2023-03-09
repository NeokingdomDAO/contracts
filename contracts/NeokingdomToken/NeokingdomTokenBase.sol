// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../Voting/IVoting.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";

contract NeokingdomTokenBase is ERC20Upgradeable {
    IVoting internal _voting;
    IShareholderRegistry internal _shareholderRegistry;

    function initialize(string memory name, string memory symbol)
        public
        virtual
    {
        __ERC20_init(name, symbol);
    }

    struct Offer {
        uint256 expiration;
        uint256 amount;
    }

    struct Offers {
        uint128 start;
        uint128 end;
        mapping(uint128 => Offer) offer;
    }

    function _enqueue(Offers storage offers, Offer memory offer)
        internal
        returns (uint128)
    {
        offers.offer[offers.end] = offer;
        return offers.end++;
    }

    event OfferCreated(
        uint128 id,
        address from,
        uint256 amount,
        uint256 expiration
    );

    event OfferExpired(uint128 id, address from, uint256 amount);

    event OfferMatched(uint128 id, address from, address to, uint256 amount);

    event VestingSet(address to, uint256 amount);

    uint256 public constant OFFER_EXPIRATION = 7 days;

    // TODO: what happens to vesting tokens when someone loses the contributor status?
    // In theory they should be burned or added to a pool
    mapping(address => uint256) internal _vestingBalance;
    mapping(address => uint256) internal _unlockedBalance;
    mapping(address => Offers) internal _offers;

    function _setVoting(IVoting voting) internal {
        _voting = voting;
    }

    function _setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        internal
        virtual
    {
        _shareholderRegistry = shareholderRegistry;
    }

    function _createOffer(address account, uint256 amount) internal virtual {
        // Vesting tokens cannot be offered because they need to be vested
        // before they can be transferred
        require(
            amount <=
                balanceOf(account) -
                    _vestingBalance[account] -
                    _unlockedBalance[account],
            "NeokingdomToken: offered amount exceeds balance"
        );
        uint256 expiration = block.timestamp + OFFER_EXPIRATION;
        uint128 id = _enqueue(_offers[account], Offer(expiration, amount));

        emit OfferCreated(id, _msgSender(), amount, expiration);
    }

    function _drainOffers(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        Offers storage offers = _offers[from];

        for (uint128 i = offers.start; i < offers.end; i++) {
            Offer storage offer = offers.offer[i];

            if (block.timestamp > offer.expiration) {
                // If offer expired:

                // 1. free the tokens
                _unlockedBalance[from] += offer.amount;

                // 2. delete the expired offer
                emit OfferExpired(i, from, offer.amount);
                delete offers.offer[offers.start++];
            } else {
                // If offer is active check if the amount is bigger than the
                // current offer.
                if (amount == 0) {
                    break;
                } else if (amount >= offer.amount) {
                    amount -= offer.amount;

                    // 1. free the tokens (put them in unlocked balance, we will
                    // move them immediately after the method returns)
                    _unlockedBalance[from] += offer.amount;

                    // 2. remove the offer
                    emit OfferMatched(i, from, to, offer.amount);
                    delete offers.offer[offers.start++];

                    // If the amount is smaller than the offer amount, then
                } else {
                    // 1. free the tokens (put them in unlocked balance, we will
                    // move them immediately after the method returns)
                    _unlockedBalance[from] += amount;

                    // 2. decrease the amount of offered tokens
                    offer.amount -= amount;
                    emit OfferMatched(i, from, to, amount);

                    // 3. we've exhausted the amount, set it to zero and go back
                    // to the calling function
                    amount = 0;
                }
            }
        }

        require(amount == 0, "NeokingdomToken: amount exceeds offer");
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                from
            )
        ) {
            // Amount set to zero so it just consumes what's expired
            _drainOffers(from, address(0), 0);
            require(
                amount <= _unlockedBalance[from],
                "NeokingdomToken: transfer amount exceeds unlocked tokens"
            );
        }
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._afterTokenTransfer(from, to, amount);
        _voting.afterTokenTransfer(from, to, amount);

        // Invariants
        require(
            balanceOf(from) >= _vestingBalance[from],
            "NeokingdomToken: transfer amount exceeds vesting"
        );

        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                from
            )
        ) {
            _unlockedBalance[from] -= amount;
        }
    }

    function _matchOffer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        _drainOffers(from, to, amount);
        _transfer(from, to, amount);
    }

    // TODO: ask Marko whether vesting tokens can be given only to contributors
    function _mintVesting(address to, uint256 amount) internal virtual {
        _vestingBalance[to] += amount;
        _mint(to, amount);
        emit VestingSet(to, _vestingBalance[to]);
    }

    function _setVesting(address account, uint256 amount) internal virtual {
        require(
            amount < _vestingBalance[account],
            "NeokingdomToken: vesting can only be decreased"
        );
        _vestingBalance[account] = amount;
        emit VestingSet(account, amount);
    }

    function createOffer(uint256 amount) public virtual {
        require(
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                _msgSender()
            ),
            "NeokingdomToken: not a contributor"
        );
        _createOffer(_msgSender(), amount);
    }

    function _calculateOffersOf(address account)
        internal
        view
        virtual
        returns (uint256, uint256)
    {
        Offers storage offers = _offers[account];

        uint256 unlocked = _unlockedBalance[account];
        uint256 offered;

        for (uint128 i = offers.start; i < offers.end; i++) {
            Offer storage offer = offers.offer[i];

            if (block.timestamp > offer.expiration) {
                unlocked += offer.amount;
            } else {
                offered += offer.amount;
            }
        }
        return (offered, unlocked);
    }

    // Tokens that are still in the vesting phase
    function vestingBalanceOf(address account)
        public
        view
        virtual
        returns (uint256)
    {
        return _vestingBalance[account];
    }

    // Tokens owned by a contributor that cannot be freely transferred (see SHA Article 10)
    function lockedBalanceOf(address account)
        public
        view
        virtual
        returns (uint256)
    {
        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                account
            )
        ) {
            (, uint256 unlocked) = _calculateOffersOf(account);
            return balanceOf(account) - unlocked;
        }

        return 0;
    }

    // Tokens owned by a contributor that are offered to other contributors
    function offeredBalanceOf(address account)
        public
        view
        virtual
        returns (uint256)
    {
        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                account
            )
        ) {
            (uint256 offered, ) = _calculateOffersOf(account);
            return offered;
        }

        return 0;
    }

    // Tokens that has been offered but not bought by any other contributor
    // within the allowed timeframe.
    function unlockedBalanceOf(address account)
        public
        view
        virtual
        returns (uint256)
    {
        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                account
            )
        ) {
            (, uint256 unlocked) = _calculateOffersOf(account);
            return unlocked;
        }

        return balanceOf(account);
    }
}
