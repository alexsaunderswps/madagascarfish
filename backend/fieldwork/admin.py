from django.contrib import admin

from fieldwork.models import FieldProgram


@admin.register(FieldProgram)
class FieldProgramAdmin(admin.ModelAdmin):
    list_display = ["name", "lead_institution", "status", "region", "start_date"]
    list_filter = ["status", "lead_institution"]
    search_fields = ["name", "description", "region"]
    list_select_related = ["lead_institution"]
    filter_horizontal = ["focal_species", "partner_institutions"]
