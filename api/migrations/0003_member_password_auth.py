from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_update_rank_choices'),
    ]

    operations = [
        # Make telegram_id nullable and not unique
        migrations.AlterField(
            model_name='member',
            name='telegram_id',
            field=models.BigIntegerField(null=True, blank=True, db_index=True),
        ),
        
        # Make username unique and indexed
        migrations.AlterField(
            model_name='member',
            name='username',
            field=models.CharField(max_length=255, unique=True, db_index=True),
        ),
        
        # Add password_hash field
        migrations.AddField(
            model_name='member',
            name='password_hash',
            field=models.CharField(max_length=255, null=True, blank=True),
        ),
        
        # Add unique constraint on telegram_id with condition
        migrations.AddConstraint(
            model_name='member',
            constraint=models.UniqueConstraint(
                fields=['telegram_id'],
                condition=models.Q(telegram_id__isnull=False),
                name='unique_telegram_id'
            ),
        ),
    ]
