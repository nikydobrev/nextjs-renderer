import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { PageLayoutServiceResponse } from 'sitefinity-react-framework/sdk/services/layout-service.response';
import { LayoutService } from 'sitefinity-react-framework/sdk/services/layout.service';
import { PageParams } from './page-params';
import { Metadata } from 'next';
import { GetAllArgs } from 'sitefinity-react-framework/sdk/services/get-all-args';
import { ServiceMetadata } from 'sitefinity-react-framework/sdk/service-metadata';
import { RestService } from 'sitefinity-react-framework/sdk/rest-service';
import { RootUrlService } from 'sitefinity-react-framework/sdk/root-url.service';
import { RenderWidgetService } from 'sitefinity-react-framework/services/render-widget-service';
import { widgetRegistry } from '@/widget-registry';
import { WidgetExecutionError } from '@/components/error/widget-execution-error-component';

export async function pageLayout({ params, searchParams }: PageParams): Promise<PageLayoutServiceResponse> {
    if (params && params.slug.some(x => x === '_next')) {
        notFound();
    }

    await initStaticParams();

    const actionParam = searchParams['sfaction'];

    let headers: { [key: string]: string } = {};
    if (process.env.NODE_ENV === 'development' && actionParam) {
        const cookie = cookies().toString();
        headers = { 'Cookie': cookie };
        if (process.env.SF_CLOUD_KEY) {
            headers['X-SF-BYPASS-HOST'] = `${process.env.PROXY_ORIGINAL_HOST}:${process.env.PORT}`;
            headers['X-SF-BYPASS-HOST-VALIDATION-KEY'] = process.env.SF_CLOUD_KEY;
        } else {
            headers['X-ORIGINAL-HOST'] = `${process.env.PROXY_ORIGINAL_HOST}:${process.env.PORT}`;
        }
    }

    const layoutOrError = await LayoutService.get(params.slug.join('/'), actionParam, headers);
    const errorResponse = layoutOrError as any;
    if (errorResponse.error && errorResponse.error.code) {
        if (errorResponse.error.code === 'NotFound') {
            notFound();
        }
    }

    return layoutOrError as PageLayoutServiceResponse;
}

export async function pageMetadata({ params, searchParams }: PageParams): Promise<Metadata> {
    const layout = await pageLayout({ params, searchParams });
    if (layout.MetaInfo) {
        return {
            title: layout.MetaInfo.Title,
            description: layout.MetaInfo.Description,

            other: {
                'og-title': layout.MetaInfo.OpenGraphTitle,
                'og-image': layout.MetaInfo.OpenGraphImage,
                'og-video': layout.MetaInfo.OpenGraphVideo,
                'og-type': layout.MetaInfo.OpenGraphType,
                'og-site': layout.MetaInfo.OpenGraphSite
            }
        };
    }

    return {};
}

export async function pageStaticParams() {
    const getAllArgs: GetAllArgs = {
        Skip: 0,
        Take: 50,
        Count: true,
        Fields: ['ViewUrl', 'Renderer'],
        Type: 'Telerik.Sitefinity.Pages.Model.PageNode'
    };

    await ServiceMetadata.fetch();

    const filteredItems = [];
    while (true) {
        let items = await RestService.getItems(getAllArgs);
        let response = items.Items;
        if (response.length === 0) {
            break;
        }

        let filtered = response.filter(x => x['Renderer'] === 'React').map(x => x['ViewUrl']);
        if (filtered.length > 0) {
            filteredItems.push(...filtered);
        }

        getAllArgs.Skip = (getAllArgs.Skip as number) + (getAllArgs.Take as number);
    }

    return filteredItems.map((relativeUrl) => {
        return {
            slug: relativeUrl.split('/').splice(1)
        };
    });
}

export async function initStaticParams() {
    RootUrlService.rootUrl = `${process.env['PROXY_URL'] || process.env['NEXT_CMS_URL']}`;
    await ServiceMetadata.fetch();

    RenderWidgetService.widgetRegistry = widgetRegistry;
    RenderWidgetService.errorComponentType = WidgetExecutionError;
}
