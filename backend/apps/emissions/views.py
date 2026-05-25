from datetime import datetime, timedelta
from django.db import models
from django.db.models import Sum, Count
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import EmissionRecord
from .serializers import EmissionRecordListSerializer, EmissionRecordDetailSerializer
from apps.ingestion.models import UploadBatch
from apps.ingestion.serializers import UploadBatchSerializer

class EmissionRecordViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return EmissionRecordDetailSerializer
        return EmissionRecordListSerializer
        
    def get_queryset(self):
        org = getattr(self.request, 'organisation', None)
        if not org:
            return EmissionRecord.objects.none()
            
        queryset = EmissionRecord.objects.filter(organisation=org)
        
        # Filtering
        scope = self.request.query_params.get('scope')
        if scope:
            queryset = queryset.filter(scope=scope)
            
        review_status = self.request.query_params.get('review_status')
        if review_status:
            queryset = queryset.filter(review_status=review_status)
            
        is_suspicious = self.request.query_params.get('is_suspicious')
        if is_suspicious is not None:
            is_suspicious_bool = is_suspicious.lower() == 'true'
            queryset = queryset.filter(is_suspicious=is_suspicious_bool)
            
        batch_id = self.request.query_params.get('batch_id')
        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
            
        source_type = self.request.query_params.get('source_type')
        if source_type:
            queryset = queryset.filter(batch__source_type=source_type)
            
        # Searching
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(activity_description__icontains=search) |
                models.Q(source_ref__icontains=search)
            )
            
        return queryset

    @action(detail=False, methods=['get'], url_path='dashboard', url_name='dashboard')
    def dashboard(self, request):
        org = getattr(request, 'organisation', None)
        if not org:
            return Response({"detail": "Organization context missing."}, status=status.HTTP_400_BAD_REQUEST)
            
        records = EmissionRecord.objects.filter(organisation=org)
        batches = UploadBatch.objects.filter(organisation=org)
        
        # Total counts
        total_records = records.count()
        pending_count = records.filter(review_status=EmissionRecord.ReviewStatus.PENDING).count()
        suspicious_count = records.filter(is_suspicious=True).count()
        
        # Total CO2e by scope
        scope_sums = records.values('scope').annotate(total_co2e=Sum('normalised_qty_kg_co2e'))
        total_co2e_by_scope = {"1": 0.0, "2": 0.0, "3": 0.0}
        for item in scope_sums:
            if item['scope'] in total_co2e_by_scope and item['total_co2e'] is not None:
                total_co2e_by_scope[item['scope']] = float(item['total_co2e'])
                
        # Recent batches (last 5)
        recent_batches_qs = batches.order_by('-created_at')[:5]
        recent_batches_data = UploadBatchSerializer(recent_batches_qs, many=True).data
        
        # CO2e by month (last 6 months)
        today = datetime.now().date()
        months = []
        for i in range(5, -1, -1):
            # Calculate year and month for i months ago
            month_date = today - timedelta(days=i*30)
            first_day = month_date.replace(day=1)
            months.append(first_day)
            
        co2e_by_month_data = []
        for m in months:
            month_str = m.strftime("%Y-%m")
            # next month replacement handling
            if m.month == 12:
                next_month = m.replace(year=m.year + 1, month=1)
            else:
                next_month = m.replace(month=m.month + 1)
            
            # Query for this month
            month_records = records.filter(period_start__gte=m, period_start__lt=next_month)
            if not month_records.exists():
                # Fall back to created_at if no records have period_start in this range
                month_records = records.filter(created_at__gte=datetime.combine(m, datetime.min.time()), created_at__lt=datetime.combine(next_month, datetime.min.time()))
                
            m_sums = month_records.values('scope').annotate(total_co2e=Sum('normalised_qty_kg_co2e'))
            m_data = {"month": month_str, "scope1": 0.0, "scope2": 0.0, "scope3": 0.0}
            for item in m_sums:
                if item['scope'] == '1' and item['total_co2e'] is not None:
                    m_data['scope1'] = float(item['total_co2e'])
                elif item['scope'] == '2' and item['total_co2e'] is not None:
                    m_data['scope2'] = float(item['total_co2e'])
                elif item['scope'] == '3' and item['total_co2e'] is not None:
                    m_data['scope3'] = float(item['total_co2e'])
            co2e_by_month_data.append(m_data)
            
        return Response({
            "total_records": total_records,
            "total_co2e_by_scope": total_co2e_by_scope,
            "pending_count": pending_count,
            "suspicious_count": suspicious_count,
            "recent_batches": recent_batches_data,
            "co2e_by_month": co2e_by_month_data
        })
