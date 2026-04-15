import * as assert from 'assert';
import { describe, it } from 'vitest';
import { renderAdminPage } from '../../src/server/admin/adminPage';

describe('AdminPageMarkup', () => {
    it('uses delegated button actions instead of inline onclick handlers', () => {
        const html = renderAdminPage();

        assert.ok(html.includes("dashboardView.addEventListener('click', onDashboardClick);"));
        assert.ok(html.includes('data-action="dismiss-room"'));
        assert.ok(html.includes('data-action="kick-player"'));
        assert.ok(html.includes('data-action="edit-display-name"'));
        assert.ok(html.includes('data-action="save-storage"'));
        assert.ok(html.includes('data-action="delete-storage-key"'));
        assert.ok(html.includes('data-action="change-page"'));
        assert.ok(html.includes("dashboardView.addEventListener('submit', onDashboardSubmit);"));
        assert.ok(html.includes('name="pageSize"'));
        assert.ok(!html.includes('onclick='));
        assert.ok(!html.includes('筛选后 '));
    });
});
