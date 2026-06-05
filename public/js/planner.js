// AJAX config — points to Vercel serverless email endpoint
const tppAjax = {
    url: '/api/send-email',
    nonce: '',
    userEmail: ''
};

// State management
const selections = {
    mk: { tier1: [], tier2: [], single: [] },
    epcot: { tier1: [], tier2: [], single: [] },
    hs: { tier1: [], tier2: [], single: [] },
    ak: { multi: [], single: [] }
};

const limits = {
    mk: { tier1: 1, tier2: 2 },
    epcot: { tier1: 1, tier2: 2 },
    hs: { tier1: 1, tier2: 2 },
    ak: { multi: 3 }
};

const parkNames = {
    mk: 'Magic Kingdom',
    epcot: 'EPCOT',
    hs: 'Hollywood Studios',
    ak: 'Animal Kingdom'
};

// Show park panel
function showPark(parkId) {
    // Update tabs
    document.querySelectorAll('.tpp-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`.tpp-tab[data-park="${parkId}"]`).classList.add('active');

    // Update panels
    document.querySelectorAll('.tpp-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`panel-${parkId}`).classList.add('active');
}

// Toggle attraction selection
function toggleAttraction(element) {
    if (element.classList.contains('disabled')) return;

    const park = element.dataset.park;
    const tier = element.dataset.tier;
    const ride = element.dataset.ride;
    const rideName = element.querySelector('.tpp-attraction-name').textContent;
    const waitBadge = element.querySelector('.tpp-wait-badge');
    const waitTime = waitBadge ? waitBadge.textContent.trim() : '';
    const waitClass = waitBadge ? (waitBadge.classList.contains('high') ? 'high' : waitBadge.classList.contains('medium') ? 'medium' : 'low') : 'low';
    const noteEl = element.querySelector('.tpp-attraction-note');
    const rideNote = noteEl ? noteEl.textContent.trim() : '';

    if (element.classList.contains('selected')) {
        // Deselect
        element.classList.remove('selected');
        const index = selections[park][tier].findIndex(r => r.id === ride);
        if (index > -1) {
            selections[park][tier].splice(index, 1);
        }
    } else {
        // Check limits (except for single pass)
        if (tier !== 'single') {
            const limit = limits[park][tier];
            if (selections[park][tier].length >= limit) {
                showToast(`You can only select ${limit} ${tier === 'tier1' ? 'Tier 1' : tier === 'tier2' ? 'Tier 2' : 'Multi Pass'} attraction${limit > 1 ? 's' : ''}`);
                return;
            }
        }

        // Select
        element.classList.add('selected');
        selections[park][tier].push({ id: ride, name: rideName, wait: waitTime, waitClass: waitClass, note: rideNote });
    }

    updateCounts();
    updateDisabledStates();
    updateSummary();
}

// Update tier counts
function updateCounts() {
    // Magic Kingdom
    document.getElementById('mk-tier1-count').textContent = `${selections.mk.tier1.length}/1`;
    document.getElementById('mk-tier2-count').textContent = `${selections.mk.tier2.length}/2`;

    // EPCOT
    document.getElementById('epcot-tier1-count').textContent = `${selections.epcot.tier1.length}/1`;
    document.getElementById('epcot-tier2-count').textContent = `${selections.epcot.tier2.length}/2`;

    // Hollywood Studios
    document.getElementById('hs-tier1-count').textContent = `${selections.hs.tier1.length}/1`;
    document.getElementById('hs-tier2-count').textContent = `${selections.hs.tier2.length}/2`;

    // Animal Kingdom
    document.getElementById('ak-multi-count').textContent = `${selections.ak.multi.length}/3`;
}

// Update disabled states
function updateDisabledStates() {
    // For each park, disable unselected items when limit reached
    ['mk', 'epcot', 'hs'].forEach(park => {
        ['tier1', 'tier2'].forEach(tier => {
            const limit = limits[park][tier];
            const container = document.getElementById(`${park}-${tier}`);
            if (!container) return;

            const attractions = container.querySelectorAll('.tpp-attraction');
            const atLimit = selections[park][tier].length >= limit;

            attractions.forEach(attr => {
                if (atLimit && !attr.classList.contains('selected')) {
                    attr.classList.add('disabled');
                } else {
                    attr.classList.remove('disabled');
                }
            });
        });
    });

    // Animal Kingdom multi
    const akContainer = document.getElementById('ak-multi');
    if (akContainer) {
        const akAttractions = akContainer.querySelectorAll('.tpp-attraction');
        const akAtLimit = selections.ak.multi.length >= 3;

        akAttractions.forEach(attr => {
            if (akAtLimit && !attr.classList.contains('selected')) {
                attr.classList.add('disabled');
            } else {
                attr.classList.remove('disabled');
            }
        });
    }
}

// Update summary panel
function updateSummary() {
    const summaryBody = document.getElementById('summary-body');
    let hasSelections = false;

    // Check if any selections exist
    for (const park in selections) {
        for (const tier in selections[park]) {
            if (selections[park][tier].length > 0) {
                hasSelections = true;
                break;
            }
        }
    }

    if (!hasSelections) {
        summaryBody.innerHTML = `
            <div class="tpp-summary-empty">
                <div class="tpp-summary-empty-icon">🎢</div>
                <p>Select attractions above to build your Lightning Lane plan</p>
            </div>
        `;
        return;
    }

    let html = '<div class="tpp-summary-parks">';

    for (const park in selections) {
        const parkSelections = selections[park];
        let parkHasSelections = false;

        for (const tier in parkSelections) {
            if (parkSelections[tier].length > 0) {
                parkHasSelections = true;
                break;
            }
        }

        if (!parkHasSelections) continue;

        html += `
            <div class="tpp-summary-park">
                <div class="tpp-summary-park-header ${park}">${parkNames[park]}</div>
                <div class="tpp-summary-park-body">
        `;

        for (const tier in parkSelections) {
            if (parkSelections[tier].length === 0) continue;

            let tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
            if (tier === 'tier1') tierLabel = 'Tier 1 (Multi Pass)';
            if (tier === 'tier2') tierLabel = 'Tier 2 (Multi Pass)';
            if (tier === 'multi') tierLabel = 'Multi Pass';
            if (tier === 'single') tierLabel = 'Single Pass';

            html += `
                <div class="tpp-summary-tier">
                    <div class="tpp-summary-tier-label">${tierLabel}</div>
            `;

            parkSelections[tier].forEach(ride => {
                html += `<div class="tpp-summary-ride">${ride.name}${ride.note ? `<span class="tpp-summary-note">${ride.note}</span>` : ''}${ride.wait ? `<span class="tpp-wait-badge ${ride.waitClass}">${ride.wait}</span>` : ''}</div>`;
            });

            html += '</div>';
        }

        html += '</div></div>';
    }

    html += '</div>';
    summaryBody.innerHTML = html;
}

// Clear all selections
function clearAllSelections() {
    // Reset state
    for (const park in selections) {
        for (const tier in selections[park]) {
            selections[park][tier] = [];
        }
    }

    // Reset UI
    document.querySelectorAll('.tpp-attraction').forEach(attr => {
        attr.classList.remove('selected', 'disabled');
    });

    updateCounts();
    updateSummary();
    showToast('All selections cleared');
}

// Toggle checklist
function toggleChecklist() {
    document.getElementById('checklist').classList.toggle('open');
}

// Email modal
function openEmailModal() {
    // Reset to form state
    document.getElementById('emailFormState').style.display = '';
    document.getElementById('emailLoadingState').style.display = 'none';
    document.getElementById('emailSuccessState').style.display = 'none';
    document.getElementById('emailError').style.display = 'none';
    document.getElementById('emailSendBtn').disabled = false;
    document.getElementById('emailModal').classList.add('active');
    const emailField = document.getElementById('emailInput');
    if (!emailField.value && tppAjax.userEmail) {
        emailField.value = tppAjax.userEmail;
    }
    emailField.focus();
}

function closeEmailModal() {
    document.getElementById('emailModal').classList.remove('active');
    document.getElementById('emailInput').value = '';
}

function sendEmail() {
    const emailInput = document.getElementById('emailInput');
    const email = emailInput.value.trim();
    const errorEl = document.getElementById('emailError');

    if (!email || !email.includes('@') || !email.includes('.')) {
        errorEl.textContent = 'Please enter a valid email address.';
        errorEl.style.display = 'block';
        emailInput.focus();
        return;
    }

    let hasSelections = false;
    for (const park in selections) {
        for (const tier in selections[park]) {
            if (selections[park][tier].length > 0) { hasSelections = true; break; }
        }
        if (hasSelections) break;
    }

    if (!hasSelections) {
        errorEl.textContent = 'Please select at least one attraction first.';
        errorEl.style.display = 'block';
        return;
    }

    errorEl.style.display = 'none';
    document.getElementById('emailFormState').style.display = 'none';
    document.getElementById('emailLoadingState').style.display = 'block';

    // Listen for the response relayed back from the WordPress parent page
    var emailResponseTimeout;
    function handleEmailResponse(e) {
        if (!e.data || !e.data.tppEmailResponse) return;
        clearTimeout(emailResponseTimeout);
        window.removeEventListener('message', handleEmailResponse);

        const result = e.data.tppEmailResponse;
        document.getElementById('emailLoadingState').style.display = 'none';

        if (result.success) {
            document.getElementById('emailSuccessState').style.display = 'block';
            showToast('Plan sent to ' + email + '!');
        } else {
            document.getElementById('emailFormState').style.display = '';
            errorEl.textContent = result.message || 'Failed to send email. Please try again.';
            errorEl.style.display = 'block';
        }
    }
    window.addEventListener('message', handleEmailResponse);

    // Timeout fallback — 30 seconds
    emailResponseTimeout = setTimeout(function () {
        window.removeEventListener('message', handleEmailResponse);
        document.getElementById('emailLoadingState').style.display = 'none';
        document.getElementById('emailFormState').style.display = '';
        errorEl.textContent = 'Request timed out. Please try again.';
        errorEl.style.display = 'block';
    }, 30000);

    // Send email data to the WordPress parent page via postMessage
    window.parent.postMessage({
        tppAction: 'sendEmail',
        email: email,
        selections: selections
    }, '*');
}

// Toast notification
function showToast(message) {
    const existing = document.querySelector('.tpp-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'tpp-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// Click outside modal to close
document.getElementById('emailModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeEmailModal();
    }
});

// ==========================================
// PRINT PREVIEW FUNCTIONALITY
// ==========================================

const parkIcons = {
    mk: '🏰',
    epcot: '🌐',
    hs: '🎬',
    ak: '🦁'
};

function openPrintPreview() {
    const container = document.getElementById('printPageContent');
    let hasSelections = false;

    for (const park in selections) {
        for (const tier in selections[park]) {
            if (selections[park][tier].length > 0) {
                hasSelections = true;
                break;
            }
        }
        if (hasSelections) break;
    }

    if (!hasSelections) {
        container.innerHTML = `
            <div class="tpp-print-page">
                <div class="tpp-print-empty">
                    <div class="tpp-print-empty-icon">🎢</div>
                    <p>No attractions selected yet.<br>Select attractions first, then come back to print!</p>
                </div>
            </div>
        `;
        document.getElementById('printOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
        return;
    }

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    let html = `
        <div class="tpp-print-page">
            <div class="tpp-print-header">
                <div class="tpp-print-logo"><i class="fa-solid fa-paper-plane"></i> &nbsp; <span>Lightning Lane</span> Planner</div>
                <div class="tpp-print-header-sub">Walt Disney World — My Personal Ride Plan</div>
                <div class="tpp-print-date">📅 Created: ${dateStr}</div>
            </div>
    `;

    for (const park in selections) {
        let parkHasSelections = false;
        for (const tier in selections[park]) {
            if (selections[park][tier].length > 0) {
                parkHasSelections = true;
                break;
            }
        }
        if (!parkHasSelections) continue;

        html += `
            <div class="tpp-print-park">
                <div class="tpp-print-park-header ${park}">
                    ${parkIcons[park]} ${parkNames[park]}
                </div>
                <div class="tpp-print-park-body">
        `;

        for (const tier in selections[park]) {
            if (selections[park][tier].length === 0) continue;

            let tierLabel = tier;
            if (tier === 'tier1') tierLabel = 'Tier 1 — Multi Pass';
            if (tier === 'tier2') tierLabel = 'Tier 2 — Multi Pass';
            if (tier === 'multi') tierLabel = 'Multi Pass';
            if (tier === 'single') tierLabel = 'Single Pass (Additional Cost)';

            html += `
                <div class="tpp-print-tier">
                    <div class="tpp-print-tier-label">${tierLabel}</div>
            `;

            selections[park][tier].forEach(ride => {
                html += `
                    <div class="tpp-print-ride">
                        <div class="tpp-print-ride-check">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <div class="tpp-print-ride-info">
                            <span class="tpp-print-ride-name">${ride.name}</span>
                            ${ride.note ? `<span class="tpp-print-ride-note">${ride.note}</span>` : ''}
                        </div>
                        ${ride.wait ? `<span class="tpp-print-ride-wait ${ride.waitClass}">${ride.wait}</span>` : ''}
                    </div>
                `;
            });

            html += `</div>`;
        }

        html += `</div></div>`;
    }

    // Checklist section
    html += `
        <div class="tpp-print-checklist">
            <div class="tpp-print-checklist-title">✅ Pre-Booking Day Checklist</div>
            <div class="tpp-print-checklist-items">
                <div class="tpp-print-checklist-item"><span class="checklist-icon">📱</span> Download My Disney Experience App</div>
                <div class="tpp-print-checklist-item"><span class="checklist-icon">👨‍👩‍👧‍👦</span> Link all party members</div>
                <div class="tpp-print-checklist-item"><span class="checklist-icon">💳</span> Verify payment method</div>
                <div class="tpp-print-checklist-item"><span class="checklist-icon">⏰</span> Set alarm for 6:55 AM ET</div>
                <div class="tpp-print-checklist-item"><span class="checklist-icon">📶</span> Use strong WiFi connection</div>
                <div class="tpp-print-checklist-item"><span class="checklist-icon">📋</span> Know your priority picks</div>
            </div>
        </div>
    `;

    // Footer
    html += `
        </div>
        <div class="tpp-print-footer">
            Your Disney World vacation planning experts
        </div>
    `;

    container.innerHTML = html;
    document.getElementById('printOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePrintPreview() {
    document.getElementById('printOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function executePrint() {
    document.body.classList.add('tpp-printing');
    setTimeout(function() {
        window.print();
        document.body.classList.remove('tpp-printing');
    }, 100);
}

// Close print preview on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.getElementById('printOverlay').classList.contains('active')) {
        closePrintPreview();
    }
});

// Close print preview on backdrop click
document.getElementById('printOverlay').addEventListener('click', function(e) {
    if (e.target === this) {
        closePrintPreview();
    }
});

// Add fadeOut animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);

// ==========================
// Auto-resize iframe (postMessage)
// If this page is embedded in an iframe, send height to parent so
// the parent can resize the iframe and avoid double-scrollbars.
function sendHeightToParent() {
    try {
        const height = document.documentElement.scrollHeight || document.body.scrollHeight;
        window.parent.postMessage({ type: 'tppHeight', height: height }, '*');
    } catch (e) {
        // ignore
    }
}

window.addEventListener('load', sendHeightToParent);
window.addEventListener('resize', sendHeightToParent);

const _tppObserver = new MutationObserver(sendHeightToParent);
_tppObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
